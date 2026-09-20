import path from 'node:path';
import { loadConfig } from '../../config/appConfig.js';
import type { Equipment } from '../../types/equipment.js';
import { isEquipmentStatus, isEquipmentType } from '../../types/equipment.js';
import { isRecord } from '../../utils/isRecord.js';
import { readJsonArray, withFileLock, writeJsonArray } from './jsonFile.js';

export async function findAll(): Promise<Equipment[]> {
  return withFileLock(getFilePath(), loadEquipment);
}

export async function findById(id: string): Promise<Equipment | null> {
  const items = await findAll();
  return items.find((item) => item.id === id) ?? null;
}

export async function findBySerialNumber(serialNumber: string): Promise<Equipment | null> {
  const items = await findAll();
  return items.find((item) => item.serialNumber === serialNumber) ?? null;
}

export async function create(equipment: Equipment): Promise<Equipment> {
  const filePath = getFilePath();

  return withFileLock(filePath, async () => {
    const items = await loadEquipment();
    items.push(equipment);
    await writeJsonArray(filePath, items);
    return equipment;
  });
}

export async function update(equipment: Equipment): Promise<Equipment | null> {
  const filePath = getFilePath();

  return withFileLock(filePath, async () => {
    const items = await loadEquipment();
    const index = items.findIndex((item) => item.id === equipment.id);

    if (index === -1) {
      return null;
    }

    items[index] = equipment;
    await writeJsonArray(filePath, items);
    return equipment;
  });
}

export async function remove(id: string): Promise<boolean> {
  const filePath = getFilePath();

  return withFileLock(filePath, async () => {
    const items = await loadEquipment();
    const next = items.filter((item) => item.id !== id);

    if (next.length === items.length) {
      return false;
    }

    await writeJsonArray(filePath, next);
    return true;
  });
}

function getFilePath(): string {
  return path.resolve(loadConfig().equipmentFile);
}

async function loadEquipment(): Promise<Equipment[]> {
  const parsed = await readJsonArray(getFilePath());
  return parsed.flatMap((item) => {
    const equipment = parseStoredEquipment(item);
    return equipment === null ? [] : [equipment];
  });
}

function parseStoredEquipment(value: unknown): Equipment | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim() === '') {
    return null;
  }

  if (typeof value.name !== 'string' || typeof value.serialNumber !== 'string') {
    return null;
  }

  if (!isEquipmentType(value.type) || !isEquipmentStatus(value.status)) {
    return null;
  }

  if (typeof value.installedAt !== 'string' || !isRecord(value.location)) {
    return null;
  }

  const { lat, lon } = value.location;

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    type: value.type,
    serialNumber: value.serialNumber,
    location: { lat, lon },
    status: value.status,
    installedAt: value.installedAt,
  };
}
