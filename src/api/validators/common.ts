import { z } from 'zod';
import { MAX_LIMIT } from '../../config/constants.js';
import { SORT_ORDERS } from '../../types/equipment.js';

export const idParamsSchema = z.object({
  id: z.string().trim().min(1, { error: 'id обязателен' }),
});

export type IdParams = z.infer<typeof idParamsSchema>;

export const pageQuerySchema = z
  .string()
  .regex(/^[1-9]\d*$/, { error: 'page должно быть положительным целым числом' })
  .transform((value) => Number(value))
  .optional();

export const limitQuerySchema = z
  .string()
  .regex(/^[1-9]\d*$/, { error: 'limit должно быть положительным целым числом' })
  .transform((value) => Number(value))
  .refine((value) => value <= MAX_LIMIT, {
    error: `limit не может быть больше ${MAX_LIMIT}`,
  })
  .optional();

export const sortOrderQuerySchema = z
  .enum(SORT_ORDERS, {
    error: 'Недопустимое значение',
  })
  .optional();

export const isoDateSchema = z
  .string()
  .trim()
  .min(1, { error: 'Должна быть валидная ISO-дата' })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    error: 'Должна быть валидная ISO-дата',
  });

export const isoDateTimeSchema = z
  .string()
  .trim()
  .min(1, { error: 'Должна быть валидная ISO datetime' })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    error: 'Должна быть валидная ISO datetime',
  });

export function isNotInFutureDate(value: string): boolean {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return false;
  }

  const installedDate = new Date(timestamp).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return installedDate <= today;
}
