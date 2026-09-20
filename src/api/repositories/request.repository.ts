import path from 'node:path';
import { loadConfig } from '../../config/appConfig.js';
import type { MaintenanceRequest } from '../../types/request.js';
import { isRequestPriority, isRequestStatus } from '../../types/request.js';
import { isRecord } from '../../utils/isRecord.js';
import { readJsonArray, withFileLock, writeJsonArray } from './jsonFile.js';

export async function findAll(): Promise<MaintenanceRequest[]> {
  return withFileLock(getFilePath(), loadRequests);
}

export async function findById(id: string): Promise<MaintenanceRequest | null> {
  const items = await findAll();
  return items.find((item) => item.id === id) ?? null;
}

export async function findByEquipmentId(equipmentId: string): Promise<MaintenanceRequest[]> {
  const items = await findAll();
  return items.filter((item) => item.equipmentId === equipmentId);
}

export async function create(request: MaintenanceRequest): Promise<MaintenanceRequest> {
  const filePath = getFilePath();

  return withFileLock(filePath, async () => {
    const items = await loadRequests();
    items.push(request);
    await writeJsonArray(filePath, items);
    return request;
  });
}

export async function update(request: MaintenanceRequest): Promise<MaintenanceRequest | null> {
  const filePath = getFilePath();

  return withFileLock(filePath, async () => {
    const items = await loadRequests();
    const index = items.findIndex((item) => item.id === request.id);

    if (index === -1) {
      return null;
    }

    items[index] = request;
    await writeJsonArray(filePath, items);
    return request;
  });
}

export async function remove(id: string): Promise<boolean> {
  const filePath = getFilePath();

  return withFileLock(filePath, async () => {
    const items = await loadRequests();
    const next = items.filter((item) => item.id !== id);

    if (next.length === items.length) {
      return false;
    }

    await writeJsonArray(filePath, next);
    return true;
  });
}

function getFilePath(): string {
  return path.resolve(loadConfig().requestsFile);
}

async function loadRequests(): Promise<MaintenanceRequest[]> {
  const parsed = await readJsonArray(getFilePath());
  return parsed.flatMap((item) => {
    const request = parseStoredRequest(item);
    return request === null ? [] : [request];
  });
}

function parseStoredRequest(value: unknown): MaintenanceRequest | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim() === '') {
    return null;
  }

  if (typeof value.equipmentId !== 'string' || value.equipmentId.trim() === '') {
    return null;
  }

  if (typeof value.title !== 'string' || typeof value.description !== 'string') {
    return null;
  }

  if (!isRequestPriority(value.priority) || !isRequestStatus(value.status)) {
    return null;
  }

  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    return null;
  }

  const request: MaintenanceRequest = {
    id: value.id,
    equipmentId: value.equipmentId,
    title: value.title,
    description: value.description,
    priority: value.priority,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };

  if (value.plannedAt !== undefined) {
    if (typeof value.plannedAt !== 'string') {
      return null;
    }

    request.plannedAt = value.plannedAt;
  }

  return request;
}
