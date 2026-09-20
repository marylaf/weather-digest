import { randomUUID } from 'node:crypto';
import type {
  CreateEquipmentInput,
  Equipment,
  EquipmentListQuery,
  EquipmentListResult,
  EquipmentSortField,
  EquipmentStatus,
  EquipmentType,
  GeoLocation,
  SortOrder,
  UpdateEquipmentInput,
} from '../../types/equipment.js';
import {
  EQUIPMENT_STATUSES,
  EQUIPMENT_TYPES,
  isEquipmentSortField,
  isEquipmentStatus,
  isEquipmentType,
  isSortOrder,
} from '../../types/equipment.js';
import { isRecord } from '../../utils/isRecord.js';
import { HttpError } from '../errors/httpError.js';
import * as equipmentRepository from '../repositories/equipment.repository.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_SORT_BY: EquipmentSortField = 'name';
const DEFAULT_ORDER: SortOrder = 'asc';

export async function createEquipment(input: unknown): Promise<Equipment> {
  const payload = parseCreateInput(input);
  await assertSerialNumberAvailable(payload.serialNumber);

  const equipment: Equipment = {
    id: randomUUID(),
    ...payload,
  };

  return equipmentRepository.create(equipment);
}

export async function getEquipmentById(id: string): Promise<Equipment> {
  const equipment = await equipmentRepository.findById(id);

  if (equipment === null) {
    throw new HttpError(404, 'Equipment not found');
  }

  return equipment;
}

/**
 * Query params: status, type, installedFrom, installedTo, sortBy, order, page, limit.
 * sortBy whitelist: name, type, status, serialNumber, installedAt.
 */
export async function listEquipment(query: EquipmentListQuery): Promise<EquipmentListResult> {
  const items = await equipmentRepository.findAll();
  const filtered = items.filter((item) => matchesFilters(item, query));
  const total = filtered.length;
  const sortBy = parseSortBy(query.sortBy);
  const order = parseOrder(query.order);
  const sorted = [...filtered].sort((left, right) => compareEquipment(left, right, sortBy, order));
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const start = (page - 1) * limit;

  return {
    data: sorted.slice(start, start + limit),
    meta: { total, page, limit },
  };
}

export async function updateEquipment(id: string, input: unknown): Promise<Equipment> {
  const current = await getEquipmentById(id);
  const changes = parseUpdateInput(input);

  if (changes.serialNumber !== undefined && changes.serialNumber !== current.serialNumber) {
    await assertSerialNumberAvailable(changes.serialNumber);
  }

  const updated: Equipment = {
    ...current,
    ...changes,
    id: current.id,
  };

  const saved = await equipmentRepository.update(updated);

  if (saved === null) {
    throw new HttpError(404, 'Equipment not found');
  }

  return saved;
}

export async function deleteEquipment(id: string): Promise<void> {
  // TODO(feat/requests-crud): forbid delete when equipment has open maintenance requests
  const deleted = await equipmentRepository.remove(id);

  if (!deleted) {
    throw new HttpError(404, 'Equipment not found');
  }
}

async function assertSerialNumberAvailable(serialNumber: string): Promise<void> {
  const existing = await equipmentRepository.findBySerialNumber(serialNumber);

  if (existing !== null) {
    throw new HttpError(409, 'Equipment with this serialNumber already exists');
  }
}

function matchesFilters(item: Equipment, query: EquipmentListQuery): boolean {
  if (query.status !== undefined && item.status !== query.status) {
    return false;
  }

  if (query.type !== undefined && item.type !== query.type) {
    return false;
  }

  const installedAt = toDateOnly(item.installedAt);

  if (query.installedFrom !== undefined) {
    const from = toDateOnly(query.installedFrom);
    if (from !== null && (installedAt === null || installedAt < from)) {
      return false;
    }
  }

  if (query.installedTo !== undefined) {
    const to = toDateOnly(query.installedTo);
    if (to !== null && (installedAt === null || installedAt > to)) {
      return false;
    }
  }

  return true;
}

function compareEquipment(
  left: Equipment,
  right: Equipment,
  sortBy: EquipmentSortField,
  order: SortOrder,
): number {
  const result = left[sortBy].localeCompare(right[sortBy], 'en', {
    numeric: true,
    sensitivity: 'base',
  });
  const directed = order === 'asc' ? result : -result;
  return directed !== 0 ? directed : left.id.localeCompare(right.id);
}

function parseCreateInput(input: unknown): CreateEquipmentInput {
  if (!isRecord(input)) {
    throw new HttpError(400, 'Invalid equipment payload');
  }

  return {
    name: parseName(input.name),
    type: parseType(input.type),
    serialNumber: parseSerialNumber(input.serialNumber),
    location: parseLocation(input.location),
    status: parseStatus(input.status),
    installedAt: parseInstalledAt(input.installedAt),
  };
}

function parseUpdateInput(input: unknown): UpdateEquipmentInput {
  if (!isRecord(input)) {
    throw new HttpError(400, 'Invalid equipment payload');
  }

  const changes: UpdateEquipmentInput = {};

  if (input.name !== undefined) {
    changes.name = parseName(input.name);
  }

  if (input.type !== undefined) {
    changes.type = parseType(input.type);
  }

  if (input.serialNumber !== undefined) {
    changes.serialNumber = parseSerialNumber(input.serialNumber);
  }

  if (input.location !== undefined) {
    changes.location = parseLocation(input.location);
  }

  if (input.status !== undefined) {
    changes.status = parseStatus(input.status);
  }

  if (input.installedAt !== undefined) {
    changes.installedAt = parseInstalledAt(input.installedAt);
  }

  return changes;
}

function parseName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'name must be a string between 3 and 100 characters');
  }

  const name = value.trim();

  if (name.length < 3 || name.length > 100) {
    throw new HttpError(400, 'name must be a string between 3 and 100 characters');
  }

  return name;
}

function parseType(value: unknown): EquipmentType {
  if (!isEquipmentType(value)) {
    throw new HttpError(400, `type must be one of: ${EQUIPMENT_TYPES.join(', ')}`);
  }

  return value;
}

function parseSerialNumber(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'serialNumber is required');
  }

  const serialNumber = value.trim();

  if (serialNumber.length === 0) {
    throw new HttpError(400, 'serialNumber is required');
  }

  return serialNumber;
}

function parseLocation(value: unknown): GeoLocation {
  if (!isRecord(value)) {
    throw new HttpError(400, 'location must be an object with lat and lon');
  }

  const { lat, lon } = value;

  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new HttpError(400, 'location.lat must be a number between -90 and 90');
  }

  if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new HttpError(400, 'location.lon must be a number between -180 and 180');
  }

  return { lat, lon };
}

function parseStatus(value: unknown): EquipmentStatus {
  if (!isEquipmentStatus(value)) {
    throw new HttpError(400, `status must be one of: ${EQUIPMENT_STATUSES.join(', ')}`);
  }

  return value;
}

function parseInstalledAt(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'installedAt must be a valid ISO date');
  }

  const installedAt = value.trim();
  const installedDate = toDateOnly(installedAt);

  if (installedDate === null) {
    throw new HttpError(400, 'installedAt must be a valid ISO date');
  }

  const today = new Date().toISOString().slice(0, 10);

  if (installedDate > today) {
    throw new HttpError(400, 'installedAt must not be in the future');
  }

  return installedAt;
}

function parseSortBy(value: string | undefined): EquipmentSortField {
  if (value === undefined || !isEquipmentSortField(value)) {
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

function toDateOnly(value: string): string | null {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}
