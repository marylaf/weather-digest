import { randomUUID } from 'node:crypto';
import type { SortOrder } from '../../types/equipment.js';
import { isSortOrder } from '../../types/equipment.js';
import type {
  CreateRequestInput,
  MaintenanceRequest,
  RequestListQuery,
  RequestListResult,
  RequestPriority,
  RequestSortField,
  RequestStatus,
  UpdateRequestInput,
} from '../../types/request.js';
import {
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  isRequestPriority,
  isRequestSortField,
  isRequestStatus,
} from '../../types/request.js';
import { isRecord } from '../../utils/isRecord.js';
import { HttpError } from '../errors/httpError.js';
import * as equipmentRepository from '../repositories/equipment.repository.js';
import * as requestRepository from '../repositories/request.repository.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_SORT_BY: RequestSortField = 'createdAt';
const DEFAULT_ORDER: SortOrder = 'asc';
const TITLE_MIN_LENGTH = 5;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;

const STATUS_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: [],
};

export async function createRequest(input: unknown): Promise<MaintenanceRequest> {
  const payload = parseCreateInput(input);
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

export async function getRequestById(id: string): Promise<MaintenanceRequest> {
  const request = await requestRepository.findById(id);

  if (request === null) {
    throw new HttpError(404, 'Maintenance request not found');
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
  const sortBy = parseSortBy(query.sortBy);
  const order = parseOrder(query.order);
  const sorted = [...filtered].sort((left, right) => compareRequests(left, right, sortBy, order));
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const start = (page - 1) * limit;

  return {
    data: sorted.slice(start, start + limit),
    meta: { total, page, limit },
  };
}

export async function updateRequest(id: string, input: unknown): Promise<MaintenanceRequest> {
  const current = await getRequestById(id);
  const changes = parseUpdateInput(input);
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
    throw new HttpError(404, 'Maintenance request not found');
  }

  return saved;
}

export async function updateRequestStatus(id: string, input: unknown): Promise<MaintenanceRequest> {
  const current = await getRequestById(id);
  const status = parseStatusInput(input);
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
    throw new HttpError(404, 'Maintenance request not found');
  }

  return saved;
}

export async function deleteRequest(id: string): Promise<void> {
  const deleted = await requestRepository.remove(id);

  if (!deleted) {
    throw new HttpError(404, 'Maintenance request not found');
  }
}

async function assertEquipmentExists(equipmentId: string): Promise<void> {
  const equipment = await equipmentRepository.findById(equipmentId);

  if (equipment === null) {
    throw new HttpError(404, 'Equipment not found');
  }
}

function assertStatusTransition(from: RequestStatus, to: RequestStatus): void {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new HttpError(409, `Cannot transition status from ${from} to ${to}`);
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

function parseCreateInput(input: unknown): CreateRequestInput {
  if (!isRecord(input)) {
    throw new HttpError(400, 'Invalid maintenance request payload');
  }

  const payload: CreateRequestInput = {
    equipmentId: parseEquipmentId(input.equipmentId),
    title: parseTitle(input.title),
    description: parseDescription(input.description),
    priority: parsePriority(input.priority),
  };

  if (input.plannedAt !== undefined) {
    payload.plannedAt = parsePlannedAt(input.plannedAt);
  }

  return payload;
}

function parseUpdateInput(input: unknown): UpdateRequestInput {
  if (!isRecord(input)) {
    throw new HttpError(400, 'Invalid maintenance request payload');
  }

  const changes: UpdateRequestInput = {};

  if (input.title !== undefined) {
    changes.title = parseTitle(input.title);
  }

  if (input.description !== undefined) {
    changes.description = parseDescription(input.description);
  }

  if (input.priority !== undefined) {
    changes.priority = parsePriority(input.priority);
  }

  if (input.plannedAt !== undefined) {
    changes.plannedAt = parsePlannedAt(input.plannedAt);
  }

  return changes;
}

function parseStatusInput(input: unknown): RequestStatus {
  if (!isRecord(input)) {
    throw new HttpError(400, 'Invalid status payload');
  }

  return parseStatus(input.status);
}

function parseEquipmentId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'equipmentId is required');
  }

  const equipmentId = value.trim();

  if (equipmentId.length === 0) {
    throw new HttpError(400, 'equipmentId is required');
  }

  return equipmentId;
}

function parseTitle(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError(
      400,
      `title must be a string between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters`,
    );
  }

  const title = value.trim();

  if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    throw new HttpError(
      400,
      `title must be a string between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters`,
    );
  }

  return title;
}

function parseDescription(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError(
      400,
      `description must be a string up to ${DESCRIPTION_MAX_LENGTH} characters`,
    );
  }

  const description = value.trim();

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    throw new HttpError(
      400,
      `description must be a string up to ${DESCRIPTION_MAX_LENGTH} characters`,
    );
  }

  return description;
}

function parsePriority(value: unknown): RequestPriority {
  if (!isRequestPriority(value)) {
    throw new HttpError(400, `priority must be one of: ${REQUEST_PRIORITIES.join(', ')}`);
  }

  return value;
}

function parseStatus(value: unknown): RequestStatus {
  if (!isRequestStatus(value)) {
    throw new HttpError(400, `status must be one of: ${REQUEST_STATUSES.join(', ')}`);
  }

  return value;
}

function parsePlannedAt(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'plannedAt must be a valid ISO datetime');
  }

  const plannedAt = value.trim();
  const timestamp = Date.parse(plannedAt);

  if (Number.isNaN(timestamp)) {
    throw new HttpError(400, 'plannedAt must be a valid ISO datetime');
  }

  return plannedAt;
}

function parseSortBy(value: string | undefined): RequestSortField {
  if (value === undefined || !isRequestSortField(value)) {
    return DEFAULT_SORT_BY;
  }

  return value;
}

function parseOrder(value: string | undefined): SortOrder {
  if (value === undefined || !isSortOrder(value)) {
    return DEFAULT_ORDER;
  }

  return value;
}

function parsePage(value: string | undefined): number {
  return parsePositiveInt(value, DEFAULT_PAGE);
}

function parseLimit(value: string | undefined): number {
  return Math.min(parsePositiveInt(value, DEFAULT_LIMIT), MAX_LIMIT);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}
