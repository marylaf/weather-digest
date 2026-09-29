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
  comment: z.string().trim().max(2000).optional(),
});

const assigneeHoursSchema = z
  .union([z.number(), z.string().trim()])
  .optional()
  .refine(
    (value) => {
      if (value === undefined) {
        return true;
      }

      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numeric) && numeric >= 0 && numeric <= 9999.99;
    },
    { error: 'hours должно быть числом от 0 до 9999.99' },
  )
  .transform((value) => {
    if (value === undefined) {
      return '0.00';
    }

    const numeric = typeof value === 'number' ? value : Number(value);
    return numeric.toFixed(2);
  });

const assigneeItemSchema = z.object({
  technicianId: z.string().trim().min(1, { error: 'technicianId обязателен' }),
  role: z.enum(['lead', 'member'], { error: 'Недопустимое значение' }),
  hours: assigneeHoursSchema,
});

export const replaceAssigneesBodySchema = z
  .object({
    assignees: z.array(assigneeItemSchema).min(1, { error: 'Нужен хотя бы один специалист' }),
  })
  .refine((value) => value.assignees.filter((item) => item.role === 'lead').length === 1, {
    error: 'В бригаде должен быть ровно один специалист с ролью lead',
    path: ['assignees'],
  });

export const requestIdParamsSchema = idParamsSchema;

export const requestAssigneeParamsSchema = z.object({
  id: z.string().trim().min(1, { error: 'id обязателен' }),
  userId: z.string().trim().min(1, { error: 'userId обязателен' }),
});

export const requestListQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES, { error: 'Недопустимое значение' }).optional(),
  priority: z.enum(REQUEST_PRIORITIES, { error: 'Недопустимое значение' }).optional(),
  equipmentId: z.string().trim().min(1).optional(),
  createdFrom: isoDateSchema.optional(),
  createdTo: isoDateSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sortBy: z.enum(REQUEST_SORT_FIELDS, { error: 'Недопустимое значение' }).optional(),
  order: sortOrderQuerySchema,
  page: pageQuerySchema,
  limit: limitQuerySchema,
});

export const nestedRequestListQuerySchema = requestListQuerySchema.omit({ equipmentId: true });
