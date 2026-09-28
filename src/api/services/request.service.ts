import { randomUUID } from 'node:crypto';
import {
  ConflictError,
  HttpAppError,
  NotFoundError,
  ValidationError,
} from '../../errors/httpErrors.js';
import type {
  CreateRequestInput,
  ImportRequestError,
  ImportRequestItemResult,
  ImportRequestsResult,
  MaintenanceRequest,
  RequestListQuery,
  RequestListResult,
  RequestStatus,
  UpdateRequestInput,
} from '../../types/request.js';
import * as equipmentRepository from '../repositories/equipment.repository.js';
import * as requestRepository from '../repositories/request.repository.js';
import { createRequestBodySchema } from '../validators/request.js';

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
 * Filtering, sorting and pagination run in PostgreSQL.
 * sortBy whitelist: title, priority, status, createdAt, plannedAt, equipmentId.
 */
export async function listRequests(query: RequestListQuery): Promise<RequestListResult> {
  return requestRepository.list(query);
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
  return requestRepository.hasOpenByEquipmentId(equipmentId);
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
