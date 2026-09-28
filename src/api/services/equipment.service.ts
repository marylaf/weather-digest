import { randomUUID } from 'node:crypto';
import { loadConfig } from '../../config/appConfig.js';
import { DEFAULT_DAYS } from '../../config/constants.js';
import {
  HttpStatusError,
  InvalidApiResponseError,
  InvalidJsonError,
  NetworkError,
  TimeoutError,
} from '../../errors/appError.js';
import { ConflictError, ExternalServiceError, NotFoundError } from '../../errors/httpErrors.js';
import { getForecastByCoordinates, isOutdoorWorkSuitable } from '../../services/weatherService.js';
import type {
  CreateEquipmentInput,
  Equipment,
  EquipmentListQuery,
  EquipmentListResult,
  UpdateEquipmentInput,
} from '../../types/equipment.js';
import type { EquipmentWeather } from '../../types/weather.js';
import * as equipmentRepository from '../repositories/equipment.repository.js';
import * as requestService from './request.service.js';

export async function createEquipment(payload: CreateEquipmentInput): Promise<Equipment> {
  await assertSerialNumberAvailable(payload.serialNumber);

  const equipment: Equipment = {
    id: randomUUID(),
    name: payload.name,
    type: payload.type,
    serialNumber: payload.serialNumber,
    location: payload.location,
    status: payload.status,
    installedAt: payload.installedAt,
    passport: null,
  };

  return equipmentRepository.create(equipment);
}

export async function getEquipmentById(id: string): Promise<Equipment> {
  const equipment = await equipmentRepository.findById(id);

  if (equipment === null) {
    throw new NotFoundError('Equipment not found');
  }

  return equipment;
}

export async function getEquipmentWeather(id: string): Promise<EquipmentWeather> {
  const equipment = await getEquipmentById(id);

  try {
    const weather = await getForecastByCoordinates(
      equipment.location.lat,
      equipment.location.lon,
      DEFAULT_DAYS,
    );

    return {
      equipmentId: equipment.id,
      weather,
      outdoorWorkSuitable: isOutdoorWorkSuitable(weather.forecast, loadConfig().maxWindSpeed),
    };
  } catch (error) {
    throw mapWeatherError(error);
  }
}

/**
 * Query params: status, type, installedFrom, installedTo, sortBy, order, page, limit.
 * Filtering, sorting and pagination run in PostgreSQL.
 * sortBy whitelist: name, type, status, serialNumber, installedAt.
 */
export async function listEquipment(query: EquipmentListQuery): Promise<EquipmentListResult> {
  return equipmentRepository.list(query);
}

export async function updateEquipment(
  id: string,
  changes: UpdateEquipmentInput,
): Promise<Equipment> {
  const current = await getEquipmentById(id);

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
    throw new NotFoundError('Equipment not found');
  }

  return saved;
}

export async function deleteEquipment(id: string): Promise<void> {
  await getEquipmentById(id);

  if (await requestService.hasOpenRequests(id)) {
    throw new ConflictError('Equipment has open maintenance requests');
  }

  const deleted = await equipmentRepository.remove(id);

  if (!deleted) {
    throw new NotFoundError('Equipment not found');
  }
}

async function assertSerialNumberAvailable(serialNumber: string): Promise<void> {
  const existing = await equipmentRepository.findBySerialNumber(serialNumber);

  if (existing !== null) {
    throw new ConflictError('Equipment with this serialNumber already exists');
  }
}

function mapWeatherError(error: unknown): ExternalServiceError {
  if (error instanceof TimeoutError) {
    return new ExternalServiceError('Weather service request timed out', { cause: error });
  }

  if (error instanceof InvalidJsonError || error instanceof InvalidApiResponseError) {
    return new ExternalServiceError('Weather service returned an invalid response', {
      cause: error,
    });
  }

  if (error instanceof NetworkError || error instanceof HttpStatusError) {
    return new ExternalServiceError('Weather service is unavailable', { cause: error });
  }

  return new ExternalServiceError('Weather service is unavailable', { cause: error });
}
