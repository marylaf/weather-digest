import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT, MAX_OFFSET } from '../../config/constants.js';
import { ValidationError } from '../../errors/httpErrors.js';
import type { SortOrder } from '../../types/equipment.js';

export interface PageWindow {
  page: number;
  limit: number;
  offset: number;
}

/**
 * `page` stays the public parameter. SQL uses LIMIT/OFFSET.
 * Negative values and limits above {@link MAX_LIMIT} are rejected with 400.
 * Offset above {@link MAX_OFFSET} is rejected with 400.
 */
export function resolvePageWindow(page: number | undefined, limit: number | undefined): PageWindow {
  const resolvedLimit = limit ?? DEFAULT_LIMIT;
  const resolvedPage = page ?? DEFAULT_PAGE;

  if (!Number.isInteger(resolvedLimit) || resolvedLimit < 1) {
    throw paginationError('limit', 'limit должно быть положительным целым числом');
  }

  if (resolvedLimit > MAX_LIMIT) {
    throw paginationError('limit', `limit не может быть больше ${MAX_LIMIT}`);
  }

  if (!Number.isInteger(resolvedPage) || resolvedPage < 1) {
    throw paginationError('page', 'page должно быть положительным целым числом');
  }

  const offset = (resolvedPage - 1) * resolvedLimit;

  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw paginationError('page', 'Слишком большое смещение');
  }

  return { page: resolvedPage, limit: resolvedLimit, offset };
}

/**
 * Accepts only whitelist members. The returned value is later mapped to a fixed SQL expression.
 */
export function resolveSortField<T extends string>(
  sortBy: string | undefined,
  allowed: readonly T[],
  defaultSort: T,
): T {
  const resolved = (sortBy ?? defaultSort) as T;

  if (!allowed.includes(resolved)) {
    throw new ValidationError(
      [{ field: 'sortBy', message: 'Недопустимое значение' }],
      'Некорректные данные запроса',
    );
  }

  return resolved;
}

export function resolveSortOrder(order: string | undefined): SortOrder {
  const resolved = order ?? 'asc';

  if (resolved !== 'asc' && resolved !== 'desc') {
    throw new ValidationError(
      [{ field: 'order', message: 'Недопустимое значение' }],
      'Некорректные данные запроса',
    );
  }

  return resolved;
}

function paginationError(field: string, message: string): ValidationError {
  return new ValidationError([{ field, message }], 'Некорректные данные запроса', 400);
}
