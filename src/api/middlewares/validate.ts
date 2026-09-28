import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../errors/httpErrors.js';

interface ValidationSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
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
        next(ValidationError.fromZod(error, isPaginationError(error) ? 400 : 422));
        return;
      }

      next(error);
    }
  };
}

const PAGINATION_FIELDS = new Set(['page', 'limit']);

function isPaginationError(error: z.ZodError): boolean {
  return (
    error.issues.length > 0 &&
    error.issues.every((issue) => {
      const field = issue.path[0];
      return typeof field === 'string' && PAGINATION_FIELDS.has(field);
    })
  );
}
