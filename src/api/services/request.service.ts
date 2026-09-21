import { randomUUID } from 'node:crypto';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '../../config/constants.js';
import {
  ConflictError,
  HttpAppError,
  NotFoundError,
  ValidationError,
} from '../../errors/httpErrors.js';
import type { SortOrder } from '../../types/equipment.js';
import type {
  CreateRequestInput,
  ImportRequestError,
  ImportRequestItemResult,
  ImportRequestsResult,
  MaintenanceRequest,
  RequestListQuery,
  RequestListResult,
  RequestSortField,
  RequestStatus,
  UpdateRequestInput,
} from '../../types/request.js';
import { isOpenRequestStatus } from '../../types/request.js';
import * as equipmentRepository from '../repositories/equipment.repository.js';
import * as requestRepository from '../repositories/request.repository.js';
import { createRequestBodySchema } from '../validators/request.js';

const DEFAULT_SORT_BY: RequestSortField = 'createdAt';
const DEFAULT_ORDER: SortOrder = 'asc';

const STATUS_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: [],
};

export async function createRequest(payload: CreateRequestInput): Promise<MaintenanceRequest> {
  await assertEquipmentExists(payload.equipmentId);

  const now = new Date().toISOString();
  const request: MaintenanceRequest = {
    id: randomUUID(),
    equipmentId: payload.equipmentId,
    title: payload.title,
    description: payload.description,
    priority: payload.priority,
    status: 'new',
    createdAt: now,
    updatedAt: now,
  };

  if (payload.plannedAt !== undefined) {
    request.plannedAt = payload.plannedAt;
  }

  return requestRepository.create(request);
}

/**
 * Imports requests independently: a failed record does not roll back earlier successes.
 * Each input index gets a success payload or a structured error in the report.
 */
export async function importRequests(items: readonly unknown[]): Promise<ImportRequestsResult> {
  const results: ImportRequestItemResult[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const parsed = createRequestBodySchema.safeParse(items[index]);

    if (!parsed.success) {
      results.push({
        index,
        ok: false,
        error: toImportError(ValidationError.fromZod(parsed.error)),
      });
      continue;
    }

    try {
      const data = await createRequest(parsed.data);
      results.push({ index, ok: true, data });
    } catch (error) {
      if (error instanceof HttpAppError && error.status < 500) {
        results.push({
          index,
          ok: false,
          error: toImportError(error),
        });
        continue;
      }

      throw error;
    }
  }

  const succeeded = results.filter((item) => item.ok).length;

  return {
    meta: {
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
    },
    results,
  };
}

export async function getRequestById(id: string): Promise<MaintenanceRequest> {
  const request = await requestRepository.findById(id);

  if (request === null) {
    throw new NotFoundError('Maintenance request not found');
  }

  return request;
}

/**
 * Query params: status, priority, equipmentId, createdFrom, createdTo, sortBy, order, page, limit.
 * sortBy whitelist: title, priority, status, createdAt, plannedAt, equipmentId.
 */
export async function listRequests(query: RequestListQuery): Promise<RequestListResult> {
  const items = await requestRepository.findAll();
  const filtered = items.filter((item) => matchesFilters(item, query));
  const total = filtered.length;
  const sortBy = query.sortBy ?? DEFAULT_SORT_BY;
  const order = query.order ?? DEFAULT_ORDER;
  const sorted = [...filtered].sort((left, right) => compareRequests(left, right, sortBy, order));
  const page = query.page ?? DEFAULT_PAGE;
  const limit = query.limit ?? DEFAULT_LIMIT;
  const start = (page - 1) * limit;

  return {
    data: sorted.slice(start, start + limit),
    meta: { total, page, limit },
  };
}

export async function listRequestsByEquipmentId(
  equipmentId: string,
  query: RequestListQuery = {},
): Promise<RequestListResult> {
  await assertEquipmentExists(equipmentId);
  return listRequests({ ...query, equipmentId });
}

export async function updateRequest(
  id: string,
  changes: UpdateRequestInput,
): Promise<MaintenanceRequest> {
  const current = await getRequestById(id);
  const updated: MaintenanceRequest = {
    ...current,
    ...changes,
    id: current.id,
    equipmentId: current.equipmentId,
    status: current.status,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const saved = await requestRepository.update(updated);

  if (saved === null) {
    throw new NotFoundError('Maintenance request not found');
  }

  return saved;
}

export async function updateRequestStatus(
  id: string,
  status: RequestStatus,
): Promise<MaintenanceRequest> {
  const current = await getRequestById(id);
  assertStatusTransition(current.status, status);

  const updated: MaintenanceRequest = {
    ...current,
    status,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const saved = await requestRepository.update(updated);

  if (saved === null) {
    throw new NotFoundError('Maintenance request not found');
  }

  return saved;
}

export async function deleteRequest(id: string): Promise<void> {
  const deleted = await requestRepository.remove(id);

  if (!deleted) {
    throw new NotFoundError('Maintenance request not found');
  }
}

export async function hasOpenRequests(equipmentId: string): Promise<boolean> {
  const items = await requestRepository.findByEquipmentId(equipmentId);
  return items.some((item) => isOpenRequestStatus(item.status));
}

async function assertEquipmentExists(equipmentId: string): Promise<void> {
  const equipment = await equipmentRepository.findById(equipmentId);

  if (equipment === null) {
    throw new NotFoundError('Equipment not found');
  }
}

function toImportError(error: HttpAppError): ImportRequestError {
  const mapped: ImportRequestError = {
    code: error.code,
    message: error.message,
  };

  if (error.details !== undefined && error.details.length > 0) {
    mapped.details = error.details;
  }

  return mapped;
}

function assertStatusTransition(from: RequestStatus, to: RequestStatus): void {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`Cannot transition status from ${from} to ${to}`);
  }
}

function matchesFilters(item: MaintenanceRequest, query: RequestListQuery): boolean {
  if (query.status !== undefined && item.status !== query.status) {
    return false;
  }

  if (query.priority !== undefined && item.priority !== query.priority) {
    return false;
  }

  if (query.equipmentId !== undefined && item.equipmentId !== query.equipmentId) {
    return false;
  }

  const createdAt = Date.parse(item.createdAt);

  if (query.createdFrom !== undefined) {
    const from = Date.parse(query.createdFrom);
    if (!Number.isNaN(from) && (Number.isNaN(createdAt) || createdAt < from)) {
      return false;
    }
  }

  if (query.createdTo !== undefined) {
    const to = Date.parse(query.createdTo);
    if (!Number.isNaN(to) && (Number.isNaN(createdAt) || createdAt > to)) {
      return false;
    }
  }

  return true;
}

function compareRequests(
  left: MaintenanceRequest,
  right: MaintenanceRequest,
  sortBy: RequestSortField,
  order: SortOrder,
): number {
  const leftValue = left[sortBy] ?? '';
  const rightValue = right[sortBy] ?? '';
  const result = leftValue.localeCompare(rightValue, 'en', {
    numeric: true,
    sensitivity: 'base',
  });
  const directed = order === 'asc' ? result : -result;
  return directed !== 0 ? directed : left.id.localeCompare(right.id);
}
