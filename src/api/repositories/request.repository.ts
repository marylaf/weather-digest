import { Op, literal, type Order, type Transaction, type WhereOptions } from 'sequelize';
import { ConflictError } from '../../errors/httpErrors.js';
import { OPEN_REQUEST_STATUSES, REQUEST_SORT_FIELDS } from '../../types/request.js';
import type {
  AssignedTechnician,
  MaintenanceRequest,
  RequestListQuery,
  RequestListResult,
  RequestPriority,
  RequestSortField,
  RequestStatus,
} from '../../types/request.js';
import { MaintenanceRequest as MaintenanceRequestModel } from '../../db/models/maintenanceRequest.js';
import { RequestAssignee } from '../../db/models/requestAssignee.js';
import { Technician } from '../../db/models/technician.js';
import { ensureDb, isUuid } from './db.js';
import { resolvePageWindow, resolveSortField, resolveSortOrder } from './listQuery.js';

const API_AUTHOR = 'api';
const HISTORY_TRIGGER = 'request_status_history_forbid_mutation';
const DEFAULT_SORT: RequestSortField = 'createdAt';

const REQUEST_ATTRIBUTES = [
  'id',
  'equipmentId',
  'title',
  'description',
  'priority',
  'status',
  'plannedAt',
  'createdAt',
  'updatedAt',
] as const;

const TECHNICIAN_ATTRIBUTES = ['id', 'fullName', 'specialization', 'employeeNumber'] as const;

const REQUEST_ORDER_SQL: Record<RequestSortField, string> = {
  title: '"title"',
  priority: '"priority"::text',
  status: '"status"::text',
  createdAt: '"created_at"',
  plannedAt: '"planned_at"',
  equipmentId: '"equipment_id"',
};

/**
 * Список заявок: WHERE / ORDER BY / LIMIT / OFFSET в PostgreSQL.
 * Назначенные техники в список не входят: JOIN размножил бы строки и сломал LIMIT.
 */
export async function list(query: RequestListQuery): Promise<RequestListResult> {
  const window = resolvePageWindow(query.page, query.limit);

  if (query.equipmentId !== undefined && !isUuid(query.equipmentId)) {
    return { data: [], meta: { total: 0, page: window.page, limit: window.limit } };
  }

  ensureDb();
  const sortBy = resolveSortField(query.sortBy, REQUEST_SORT_FIELDS, DEFAULT_SORT);
  const order = resolveSortOrder(query.order);
  const where = requestWhere(query);
  const total = await MaintenanceRequestModel.count({ where });
  const rows = await MaintenanceRequestModel.findAll({
    attributes: [...REQUEST_ATTRIBUTES],
    where,
    order: requestOrder(sortBy, order),
    limit: window.limit,
    offset: window.offset,
    subQuery: false,
  });

  return {
    data: rows.map((row) => toRequest(row, false)),
    meta: { total, page: window.page, limit: window.limit },
  };
}

export async function findById(id: string): Promise<MaintenanceRequest | null> {
  if (!isUuid(id)) {
    return null;
  }

  ensureDb();
  const row = await MaintenanceRequestModel.findByPk(id, requestDetailQuery());
  return row ? toRequest(row, true) : null;
}

export async function hasOpenByEquipmentId(equipmentId: string): Promise<boolean> {
  if (!isUuid(equipmentId)) {
    return false;
  }

  ensureDb();
  const count = await MaintenanceRequestModel.count({
    where: {
      equipmentId,
      status: { [Op.in]: [...OPEN_REQUEST_STATUSES] },
    },
  });
  return count > 0;
}

export async function create(request: MaintenanceRequest): Promise<MaintenanceRequest> {
  ensureDb();
  await MaintenanceRequestModel.create({
    id: request.id,
    equipmentId: request.equipmentId,
    title: request.title,
    description: request.description,
    priority: request.priority,
    status: request.status,
    plannedAt: request.plannedAt === undefined ? null : new Date(request.plannedAt),
    author: API_AUTHOR,
    createdAt: new Date(request.createdAt),
    updatedAt: new Date(request.updatedAt),
  });

  const saved = await findById(request.id);

  if (!saved) {
    throw new Error('Maintenance request disappeared after insert');
  }

  return saved;
}

export async function update(request: MaintenanceRequest): Promise<MaintenanceRequest | null> {
  if (!isUuid(request.id)) {
    return null;
  }

  ensureDb();
  const current = await MaintenanceRequestModel.findByPk(request.id, { attributes: ['id'] });

  if (!current) {
    return null;
  }

  await current.update({
    title: request.title,
    description: request.description,
    priority: request.priority,
    status: request.status,
    plannedAt: request.plannedAt === undefined ? null : new Date(request.plannedAt),
  });

  return findById(request.id);
}

export async function remove(id: string): Promise<boolean> {
  if (!isUuid(id)) {
    return false;
  }

  const sequelize = ensureDb();

  return sequelize.transaction(async (transaction) => {
    const existing = await MaintenanceRequestModel.findByPk(id, {
      attributes: ['id'],
      transaction,
    });

    if (!existing) {
      return false;
    }

    await deleteRequestGraph([id], transaction);
    return true;
  });
}

/**
 * Удаляет закрытые заявки оборудования вместе с историей и назначениями.
 * Открытые заявки оставляют прежний ответ 409.
 */
export async function deleteAllForEquipment(
  equipmentId: string,
  transaction: Transaction,
): Promise<void> {
  const open = await MaintenanceRequestModel.count({
    where: {
      equipmentId,
      status: { [Op.in]: [...OPEN_REQUEST_STATUSES] },
    },
    transaction,
  });

  if (open > 0) {
    throw new ConflictError('Equipment has open maintenance requests');
  }

  const rows = await MaintenanceRequestModel.findAll({
    attributes: ['id'],
    where: { equipmentId },
    transaction,
  });
  await deleteRequestGraph(
    rows.map((row) => row.id),
    transaction,
  );
}

function requestDetailQuery() {
  return {
    attributes: [...REQUEST_ATTRIBUTES],
    include: [
      {
        model: Technician,
        attributes: [...TECHNICIAN_ATTRIBUTES],
        through: { attributes: ['role', 'hours'] },
      },
    ],
    order: [[{ model: Technician, as: 'Technicians' }, 'fullName', 'ASC']] as Order,
  };
}

function requestWhere(query: RequestListQuery): WhereOptions {
  const where: {
    status?: RequestStatus;
    priority?: RequestPriority;
    equipmentId?: string;
    createdAt?: Record<symbol, Date>;
  } = {};

  if (query.status !== undefined) {
    where.status = query.status;
  }

  if (query.priority !== undefined) {
    where.priority = query.priority;
  }

  if (query.equipmentId !== undefined) {
    where.equipmentId = query.equipmentId;
  }

  const created = timeRange(query.createdFrom, query.createdTo);

  if (created !== undefined) {
    where.createdAt = created;
  }

  return where;
}

function timeRange(
  from: string | undefined,
  to: string | undefined,
): Record<symbol, Date> | undefined {
  if (from === undefined && to === undefined) {
    return undefined;
  }

  return {
    ...(from !== undefined ? { [Op.gte]: new Date(from) } : {}),
    ...(to !== undefined ? { [Op.lte]: new Date(to) } : {}),
  };
}

function requestOrder(sortBy: RequestSortField, order: 'asc' | 'desc'): Order {
  const direction = order === 'desc' ? 'DESC' : 'ASC';
  const nulls = order === 'asc' ? 'NULLS FIRST' : 'NULLS LAST';
  const columnSql = REQUEST_ORDER_SQL[sortBy];

  return [
    literal(`"MaintenanceRequest".${columnSql} ${direction} ${nulls}`),
    literal('"MaintenanceRequest"."id" ASC'),
  ];
}

function toRequest(row: MaintenanceRequestModel, withAssignees: boolean): MaintenanceRequest {
  const request: MaintenanceRequest = {
    id: row.id,
    equipmentId: row.equipmentId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };

  if (row.plannedAt) {
    request.plannedAt = toIso(row.plannedAt);
  }

  if (withAssignees) {
    request.assignedTechnicians = (row.Technicians ?? []).map((technician) =>
      toAssignedTechnician(technician),
    );
  }

  return request;
}

function toAssignedTechnician(technician: Technician): AssignedTechnician {
  const assignment = readAssignment(technician);

  return {
    id: technician.id,
    fullName: technician.fullName,
    specialization: technician.specialization,
    employeeNumber: technician.employeeNumber,
    role: assignment.role,
    hours: assignment.hours,
  };
}

function readAssignment(technician: Technician): { role: 'lead' | 'member'; hours: string } {
  const source = technician as Technician & {
    RequestAssignee?: { role?: unknown; hours?: unknown };
  };
  const role = source.RequestAssignee?.role === 'lead' ? 'lead' : 'member';
  const hours = source.RequestAssignee?.hours;

  if (typeof hours === 'string' && hours.length > 0) {
    return { role, hours };
  }

  if (typeof hours === 'number' && Number.isFinite(hours)) {
    return { role, hours: hours.toFixed(2) };
  }

  return { role, hours: '0.00' };
}

async function deleteRequestGraph(ids: readonly string[], transaction: Transaction): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const sequelize = ensureDb();
  await setHistoryTrigger(false, transaction);

  try {
    await sequelize.query('DELETE FROM request_status_history WHERE request_id IN (:ids)', {
      replacements: { ids: [...ids] },
      transaction,
    });
  } finally {
    await setHistoryTrigger(true, transaction);
  }

  await RequestAssignee.destroy({
    where: { requestId: [...ids] },
    transaction,
  });
  await MaintenanceRequestModel.destroy({
    where: { id: [...ids] },
    transaction,
  });
}

async function setHistoryTrigger(enabled: boolean, transaction: Transaction): Promise<void> {
  const action = enabled ? 'ENABLE' : 'DISABLE';
  await ensureDb().query(
    `ALTER TABLE request_status_history ${action} TRIGGER ${HISTORY_TRIGGER}`,
    { transaction },
  );
}

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}
