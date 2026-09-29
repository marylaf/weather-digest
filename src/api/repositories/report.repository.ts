import { QueryTypes } from 'sequelize';
import { Equipment as EquipmentModel } from '../../db/models/equipment.js';
import { MaintenanceRequest as MaintenanceRequestModel } from '../../db/models/maintenanceRequest.js';
import { Site } from '../../db/models/site.js';
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../../types/request.js';
import type {
  EquipmentLoadQuery,
  EquipmentLoadRow,
  SiteRequestSummary,
} from '../../types/report.js';
import { ensureDb, isUuid } from './db.js';

/**
 * Заявки оборудования, часы бригады и дата выполнения считаются отдельно,
 * затем соединяются 1:1. Прямой JOIN `request_assignees` и `request_status_history`
 * размножил бы строки и завысил SUM(hours) и COUNT.
 *
 * Период — `maintenance_requests.created_at` в условии JOIN, не в WHERE:
 * иначе оборудование без заявок в периоде выпало бы из LEFT JOIN.
 * `minRequests` фильтрует уже сгруппированные строки через HAVING.
 */
export const EQUIPMENT_LOAD_SQL = `
SELECT
  e.id AS "equipmentId",
  e.name AS "name",
  COUNT(DISTINCT r.id)::integer AS "requestCount",
  COUNT(DISTINCT r.id) FILTER (
    WHERE r.status::text IN ('done', 'rejected')
  )::integer AS "closedRequestCount",
  COALESCE(SUM(assignee_hours.planned_hours), 0) AS "plannedLaborHours",
  MAX(done_events.done_at) AS "lastMaintenanceAt"
FROM equipment AS e
LEFT JOIN maintenance_requests AS r
  ON r.equipment_id = e.id
 AND r.deleted_at IS NULL
 AND ($1::timestamptz IS NULL OR r.created_at >= $1::timestamptz)
 AND ($2::timestamptz IS NULL OR r.created_at <= $2::timestamptz)
LEFT JOIN (
  SELECT
    request_assignees.request_id,
    SUM(request_assignees.hours) AS planned_hours
  FROM request_assignees
  GROUP BY request_assignees.request_id
) AS assignee_hours ON assignee_hours.request_id = r.id
LEFT JOIN (
  SELECT
    request_status_history.request_id,
    MAX(request_status_history.created_at) AS done_at
  FROM request_status_history
  WHERE request_status_history.new_status::text = 'done'
  GROUP BY request_status_history.request_id
) AS done_events ON done_events.request_id = r.id
WHERE e.deleted_at IS NULL
GROUP BY e.id, e.name
HAVING COUNT(DISTINCT r.id) >= $3::integer
ORDER BY e.name ASC, e.id ASC
`;

const AVERAGE_CLOSE_SQL = `
SELECT AVG(
  EXTRACT(EPOCH FROM (closed.closed_at - r.created_at))
) AS "averageCloseTimeSeconds"
FROM maintenance_requests AS r
INNER JOIN equipment AS e
  ON e.id = r.equipment_id
 AND e.site_id = $1
 AND e.deleted_at IS NULL
INNER JOIN (
  SELECT
    request_status_history.request_id,
    MIN(request_status_history.created_at) AS closed_at
  FROM request_status_history
  WHERE request_status_history.new_status::text IN ('done', 'rejected')
  GROUP BY request_status_history.request_id
) AS closed ON closed.request_id = r.id
WHERE r.status::text IN ('done', 'rejected')
  AND r.deleted_at IS NULL
`;

interface GroupCountRow {
  count: number | string;
  status?: string;
  priority?: string;
}

interface AverageRow {
  averageCloseTimeSeconds: number | string | null;
}

interface EquipmentLoadSqlRow {
  equipmentId: string;
  name: string;
  requestCount: number | string;
  closedRequestCount: number | string;
  plannedLaborHours: number | string;
  lastMaintenanceAt: Date | string | null;
}

/**
 * Сводка заявок площадки. Счётчики — GROUP BY в PostgreSQL, не обход findAll.
 * Среднее время закрытия — только заявки `done` и `rejected` с записью в истории.
 */
export async function getSiteSummary(siteId: string): Promise<SiteRequestSummary | null> {
  if (!isUuid(siteId)) {
    return null;
  }

  const sequelize = ensureDb();
  const site = await Site.findByPk(siteId, { attributes: ['id'] });

  if (site === null) {
    return null;
  }

  const [statusRows, priorityRows, averageRows] = await Promise.all([
    countByField('status', siteId),
    countByField('priority', siteId),
    sequelize.query<AverageRow>(AVERAGE_CLOSE_SQL, {
      type: QueryTypes.SELECT,
      bind: [siteId],
    }),
  ]);

  return {
    siteId,
    requestsByStatus: fillCounts(REQUEST_STATUSES, statusRows, 'status'),
    requestsByPriority: fillCounts(REQUEST_PRIORITIES, priorityRows, 'priority'),
    averageCloseTimeSeconds: readAverage(averageRows[0]?.averageCloseTimeSeconds),
  };
}

export async function listEquipmentLoad(query: EquipmentLoadQuery): Promise<EquipmentLoadRow[]> {
  const sequelize = ensureDb();
  const rows = await sequelize.query<EquipmentLoadSqlRow>(EQUIPMENT_LOAD_SQL, {
    type: QueryTypes.SELECT,
    bind: [query.createdFrom ?? null, query.createdTo ?? null, query.minRequests],
  });

  return rows.map(toEquipmentLoadRow);
}

async function countByField(
  field: 'status' | 'priority',
  siteId: string,
): Promise<GroupCountRow[]> {
  const rows = await MaintenanceRequestModel.count({
    include: [
      {
        model: EquipmentModel,
        attributes: [],
        required: true,
        where: { siteId },
      },
    ],
    group: [`MaintenanceRequest.${field}`],
  });

  return rows as unknown as GroupCountRow[];
}

function fillCounts<T extends string>(
  keys: readonly T[],
  rows: readonly GroupCountRow[],
  field: 'status' | 'priority',
): Record<T, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;

  for (const row of rows) {
    const key = groupedValue(row, field);

    if (key !== undefined && Object.hasOwn(counts, key)) {
      counts[key as T] = toCount(row.count);
    }
  }

  return counts;
}

function groupedValue(row: GroupCountRow, field: 'status' | 'priority'): string | undefined {
  const record = row as unknown as Record<string, unknown>;
  const direct = record[field];

  if (typeof direct === 'string') {
    return direct;
  }

  const qualified = record[`MaintenanceRequest.${field}`];
  return typeof qualified === 'string' ? qualified : undefined;
}

function readAverage(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toEquipmentLoadRow(row: EquipmentLoadSqlRow): EquipmentLoadRow {
  return {
    equipmentId: row.equipmentId,
    name: row.name,
    requestCount: toCount(row.requestCount),
    closedRequestCount: toCount(row.closedRequestCount),
    plannedLaborHours: toHours(row.plannedLaborHours),
    lastMaintenanceAt: toIsoOrNull(row.lastMaintenanceAt),
  };
}

function toCount(value: number | string): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toHours(value: number | string): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
}

function toIsoOrNull(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
