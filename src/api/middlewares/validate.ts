import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../errors/httpErrors.js';

interface ValidationSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
  /** Статус Zod-ошибки этого маршрута. Без него query/body дают 422, кроме page/limit (400). */
  errorStatus?: number;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body !== undefined) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.params !== undefined) {
        const parsed = schemas.params.parse(req.params);
        Object.assign(req.params, parsed);
      }

      if (schemas.query !== undefined) {
        const parsed = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', {
          value: parsed,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(ValidationError.fromZod(error, validationStatus(error, schemas.errorStatus)));
        return;
      }

      next(error);
    }
  };
}

const PAGINATION_FIELDS = new Set(['page', 'limit']);

function validationStatus(error: z.ZodError, explicit: number | undefined): number {
  if (explicit !== undefined) {
    return explicit;
  }

  return isPaginationError(error) ? 400 : 422;
}

function isPaginationError(error: z.ZodError): boolean {
  return (
    error.issues.length > 0 &&
    error.issues.every((issue) => {
      const field = issue.path[0];
      return typeof field === 'string' && PAGINATION_FIELDS.has(field);
    })
  );
}
