import { z } from 'zod';
import {
  EQUIPMENT_SORT_FIELDS,
  EQUIPMENT_STATUSES,
  EQUIPMENT_TYPES,
} from '../../types/equipment.js';
import {
  idParamsSchema,
  isoDateSchema,
  isNotInFutureDate,
  limitQuerySchema,
  pageQuerySchema,
  sortOrderQuerySchema,
} from './common.js';

const locationSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

const installedAtSchema = isoDateSchema.refine(isNotInFutureDate, {
  error: 'installedAt не может быть в будущем',
});

export const createEquipmentBodySchema = z.object({
  name: z.string().trim().min(3).max(100),
  type: z.enum(EQUIPMENT_TYPES, { error: 'Недопустимое значение' }),
  serialNumber: z.string().trim().min(1, { error: 'serialNumber обязателен' }),
  location: locationSchema,
  status: z.enum(EQUIPMENT_STATUSES, { error: 'Недопустимое значение' }),
  installedAt: installedAtSchema,
});

export const updateEquipmentBodySchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  type: z.enum(EQUIPMENT_TYPES, { error: 'Недопустимое значение' }).optional(),
  serialNumber: z.string().trim().min(1, { error: 'serialNumber обязателен' }).optional(),
  location: locationSchema.optional(),
  status: z.enum(EQUIPMENT_STATUSES, { error: 'Недопустимое значение' }).optional(),
  installedAt: installedAtSchema.optional(),
});

export const equipmentIdParamsSchema = idParamsSchema;

export const equipmentListQuerySchema = z.object({
  status: z.enum(EQUIPMENT_STATUSES, { error: 'Недопустимое значение' }).optional(),
  type: z.enum(EQUIPMENT_TYPES, { error: 'Недопустимое значение' }).optional(),
  installedFrom: isoDateSchema.optional(),
  installedTo: isoDateSchema.optional(),
  sortBy: z.enum(EQUIPMENT_SORT_FIELDS, { error: 'Недопустимое значение' }).optional(),
  order: sortOrderQuerySchema,
  page: pageQuerySchema,
  limit: limitQuerySchema,
});

export const equipmentWeatherParamsSchema = idParamsSchema;
