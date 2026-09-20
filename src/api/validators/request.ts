import { z } from 'zod';
import { MAX_REQUEST_IMPORT_ITEMS } from '../../config/constants.js';
import { REQUEST_PRIORITIES, REQUEST_SORT_FIELDS, REQUEST_STATUSES } from '../../types/request.js';
import {
  idParamsSchema,
  isoDateSchema,
  isoDateTimeSchema,
  limitQuerySchema,
  pageQuerySchema,
  sortOrderQuerySchema,
} from './common.js';

export const createRequestBodySchema = z.object({
  equipmentId: z.string().trim().min(1, { error: 'equipmentId обязателен' }),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().max(2000),
  priority: z.enum(REQUEST_PRIORITIES, { error: 'Недопустимое значение' }),
  plannedAt: isoDateTimeSchema.optional(),
});

export const importRequestsBodySchema = z.object({
  items: z
    .array(z.unknown())
    .min(1, { error: 'items должен содержать хотя бы одну запись' })
    .max(MAX_REQUEST_IMPORT_ITEMS, {
      error: `items не может содержать больше ${MAX_REQUEST_IMPORT_ITEMS} записей`,
    }),
});

export const updateRequestBodySchema = z.object({
  title: z.string().trim().min(5).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(REQUEST_PRIORITIES, { error: 'Недопустимое значение' }).optional(),
  plannedAt: isoDateTimeSchema.optional(),
});

export const updateRequestStatusBodySchema = z.object({
  status: z.enum(REQUEST_STATUSES, { error: 'Недопустимое значение' }),
});

export const requestIdParamsSchema = idParamsSchema;

export const requestListQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES, { error: 'Недопустимое значение' }).optional(),
  priority: z.enum(REQUEST_PRIORITIES, { error: 'Недопустимое значение' }).optional(),
  equipmentId: z.string().trim().min(1).optional(),
  createdFrom: isoDateSchema.optional(),
  createdTo: isoDateSchema.optional(),
  sortBy: z.enum(REQUEST_SORT_FIELDS, { error: 'Недопустимое значение' }).optional(),
  order: sortOrderQuerySchema,
  page: pageQuerySchema,
  limit: limitQuerySchema,
});
