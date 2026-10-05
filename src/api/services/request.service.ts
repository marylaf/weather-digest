import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import { isUniqueConstraint } from '../../errors/databaseErrors.js';
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
  ReplaceAssigneesInput,
  RequestListQuery,
  RequestListResult,
  RequestStatus,
  StatusHistoryEntry,
  UpdateRequestInput,
} from '../../types/request.js';
import * as equipmentRepository from '../repositories/equipment.repository.js';
import { ensureDb } from '../repositories/db.js';
import * as requestRepository from '../repositories/request.repository.js';
import { createRequestBodySchema } from '../validators/request.js';
import {
  assertBrigade,
  assertInProgressHasTechnicians,
  assertStatusTransition,
} from './requestRules.js';

const STATUS_CHANGE_ACTOR = 'api';

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

/**
 * Меняет статус и пишет историю в одной транзакции.
 * Строка заявки блокируется `SELECT ... FOR UPDATE`, затем проверяется переход
 * и наличие бригады для `in_progress`. Ошибка на записи истории откатывает статус.
 */
export async function updateRequestStatus(
  id: string,
  status: RequestStatus,
  comment?: string,
): Promise<MaintenanceRequest> {
  const sequelize = ensureDb();

  return sequelize.transaction(async (transaction) => {
    const current = await requestRepository.lockById(id, transaction);

    if (current === null) {
      throw new NotFoundError('Maintenance request not found');
    }

    assertStatusTransition(current.status, status);

    if (status === 'in_progress') {
      const assigneeCount = await requestRepository.countAssignees(id, transaction);
      assertInProgressHasTechnicians(assigneeCount);
    }

    await requestRepository.updateStatus(id, status, transaction);
    await requestRepository.appendStatusHistory(
      {
        requestId: id,
        oldStatus: current.status,
        newStatus: status,
        changedBy: STATUS_CHANGE_ACTOR,
        comment: normalizeComment(comment),
      },
      transaction,
    );

    const saved = await requestRepository.findById(id, transaction);

    if (saved === null) {
      throw new NotFoundError('Maintenance request not found');
    }

    return saved;
  });
}

/**
 * Заменяет бригаду целиком. В новой бригаде ровно один `lead` (422).
 * Повтор technicianId — 409 до записи. Уникальный индекс пары
 * `(request_id, technician_id)` страхует гонку и тоже даёт 409 с откатом.
 */
export async function replaceRequestAssignees(
  id: string,
  payload: ReplaceAssigneesInput,
): Promise<MaintenanceRequest> {
  const sequelize = ensureDb();

  return sequelize.transaction(async (transaction) => {
    const current = await requestRepository.lockById(id, transaction);

    if (current === null) {
      throw new NotFoundError('Maintenance request not found');
    }

    assertBrigade(payload.assignees);
    await assertTechniciansExist(
      payload.assignees.map((assignee) => assignee.technicianId),
      transaction,
    );

    try {
      await requestRepository.replaceAssignees(id, payload.assignees, transaction);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ConflictError('Technician is already assigned to this request');
      }

      throw error;
    }

    const saved = await requestRepository.findById(id, transaction);

    if (saved === null) {
      throw new NotFoundError('Maintenance request not found');
    }

    return saved;
  });
}

/**
 * Снимает одно назначение.
 * Правило «ровно один lead» относится к полной замене бригады, не к удалению строки.
 * Снять lead можно: частичный unique index запрещает второго lead, но не требует,
 * чтобы среди оставшихся member был lead. Пустая бригада после снятия последнего
 * специалиста тоже допустима. Пока назначений нет, переход в `in_progress` вернёт 409.
 */
export async function removeRequestAssignee(
  requestId: string,
  technicianId: string,
): Promise<void> {
  const sequelize = ensureDb();

  await sequelize.transaction(async (transaction) => {
    const current = await requestRepository.lockById(requestId, transaction);

    if (current === null) {
      throw new NotFoundError('Maintenance request not found');
    }

    await assertTechniciansExist([technicianId], transaction);
    const removed = await requestRepository.removeAssignee(requestId, technicianId, transaction);

    if (!removed) {
      throw new NotFoundError('Assignment not found');
    }
  });
}

export async function listRequestStatusHistory(id: string): Promise<StatusHistoryEntry[]> {
  await getRequestById(id);
  return requestRepository.listStatusHistory(id);
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

async function assertTechniciansExist(
  technicianIds: readonly string[],
  transaction: Transaction,
): Promise<void> {
  const existing = await requestRepository.findExistingTechnicianIds(technicianIds, transaction);
  const missing = technicianIds.some((technicianId) => !existing.has(technicianId));

  if (missing) {
    throw new NotFoundError('Technician not found');
  }
}

function normalizeComment(comment: string | undefined): string | null {
  if (comment === undefined) {
    return null;
  }

  const trimmed = comment.trim();
  return trimmed.length > 0 ? trimmed : null;
}
