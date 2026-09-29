import { z } from 'zod';
import { limitQuerySchema, pageQuerySchema, sortOrderQuerySchema } from './common.js';

const quantitySchema = z
  .number()
  .positive()
  .max(9999999999.99)
  .refine((value) => Math.round(value * 100) === value * 100, {
    error: 'Не больше двух знаков после запятой',
  });

export const createSparePartBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(64),
  stockQuantity: z.number().min(0).max(9999999999.99),
});

export const sparePartListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  sortBy: z.enum(['name', 'sku', 'stockQuantity'], { error: 'Недопустимое значение' }).optional(),
  order: sortOrderQuerySchema,
  page: pageQuerySchema,
  limit: limitQuerySchema,
});

export const issueSparePartBodySchema = z.object({
  sparePartId: z.string().trim().min(1, { error: 'sparePartId обязателен' }),
  quantity: quantitySchema,
});
