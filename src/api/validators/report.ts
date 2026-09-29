import { z } from 'zod';

const isoBoundSchema = z
  .string()
  .trim()
  .min(1, { error: 'Должна быть валидная ISO-дата' })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    error: 'Должна быть валидная ISO-дата',
  });

const optionalBoundSchema = isoBoundSchema.optional();

const minRequestsSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, { error: 'minRequests должно быть целым числом >= 0' })
  .transform((value) => Number(value))
  .refine((value) => Number.isSafeInteger(value), {
    error: 'minRequests должно быть целым числом >= 0',
  });

const START_KEYS = ['createdFrom', 'dateFrom', 'from'] as const;
const END_KEYS = ['createdTo', 'dateTo', 'to'] as const;

/**
 * Канонические имена — `createdFrom`, `createdTo`, `minRequests`
 * (как `createdFrom` / `createdTo` у списка заявок).
 * `dateFrom` / `from` и `dateTo` / `to` — те же границы, если каноническое имя не передано.
 * Дата без времени: начало — 00:00:00.000Z, конец — 23:59:59.999Z.
 */
export const equipmentLoadQuerySchema = z
  .object({
    createdFrom: optionalBoundSchema,
    dateFrom: optionalBoundSchema,
    from: optionalBoundSchema,
    createdTo: optionalBoundSchema,
    dateTo: optionalBoundSchema,
    to: optionalBoundSchema,
    minRequests: minRequestsSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const createdFrom = resolveAlias(value, START_KEYS, ctx, 'createdFrom');
    const createdTo = resolveAlias(value, END_KEYS, ctx, 'createdTo');

    if (createdFrom === undefined || createdTo === undefined) {
      return;
    }

    if (parseRangeStart(createdFrom).getTime() > parseRangeEnd(createdTo).getTime()) {
      ctx.addIssue({
        code: 'custom',
        path: ['createdTo'],
        message: 'createdFrom не может быть позже createdTo',
      });
    }
  })
  .transform((value) => {
    const createdFrom = firstPresent(value, START_KEYS);
    const createdTo = firstPresent(value, END_KEYS);

    return {
      ...(createdFrom === undefined ? {} : { createdFrom: parseRangeStart(createdFrom) }),
      ...(createdTo === undefined ? {} : { createdTo: parseRangeEnd(createdTo) }),
      minRequests: value.minRequests ?? 0,
    };
  });

function resolveAlias(
  value: Record<string, string | number | undefined>,
  keys: readonly string[],
  ctx: z.RefinementCtx,
  field: string,
): string | undefined {
  const present = keys.flatMap((key) => {
    const item = value[key];
    return typeof item === 'string' ? [item] : [];
  });
  const unique = new Set(present);

  if (unique.size > 1) {
    ctx.addIssue({
      code: 'custom',
      path: [field],
      message: `Укажите одно значение для ${keys.join(', ')}`,
    });
  }

  return present[0];
}

function firstPresent(
  value: Record<string, string | number | undefined>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const item = value[key];

    if (typeof item === 'string') {
      return item;
    }
  }

  return undefined;
}

function parseRangeStart(value: string): Date {
  return new Date(value);
}

function parseRangeEnd(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999Z`);
  }

  return new Date(value);
}
