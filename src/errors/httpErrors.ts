import type { ZodError } from 'zod';
import { AppError } from './appError.js';

export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Operational API error with HTTP status and machine-readable code.
 * Independent of Express Request/Response.
 */
export class HttpAppError extends AppError {
  readonly status: number;
  readonly code: string;
  readonly details?: readonly ErrorDetail[];

  constructor(
    status: number,
    code: string,
    message: string,
    options?: { details?: readonly ErrorDetail[]; cause?: unknown },
  ) {
    super(message, options);
    this.status = status;
    this.code = code;
    this.details = options?.details;
  }
}

export class NotFoundError extends HttpAppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ValidationError extends HttpAppError {
  constructor(details: readonly ErrorDetail[] = [], message = 'Некорректные данные запроса') {
    super(400, 'VALIDATION_ERROR', message, { details });
  }

  static fromZod(error: ZodError): ValidationError {
    return new ValidationError(
      error.issues.map((issue) => ({
        field: formatIssuePath(issue.path),
        message: humanizeZodIssue(issue),
      })),
    );
  }
}

export class ConflictError extends HttpAppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class ExternalServiceError extends HttpAppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(503, 'EXTERNAL_SERVICE_UNAVAILABLE', message, options);
  }
}

export class RateLimitError extends HttpAppError {
  constructor(message = 'Too many requests') {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
  }
}

export class PayloadTooLargeError extends HttpAppError {
  constructor(message = 'Request body is too large') {
    super(413, 'PAYLOAD_TOO_LARGE', message);
  }
}

export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }

      const value = String(segment);
      return index === 0 ? value : `.${value}`;
    })
    .join('');
}

function humanizeZodIssue(issue: ZodError['issues'][number]): string {
  switch (issue.code) {
    case 'invalid_value':
      return 'Недопустимое значение';
    case 'invalid_type':
      return 'Некорректный тип';
    case 'too_small':
      return issue.origin === 'string' ? 'Слишком короткое значение' : 'Значение слишком маленькое';
    case 'too_big':
      return issue.origin === 'string' ? 'Слишком длинное значение' : 'Значение слишком большое';
    case 'invalid_format':
      return 'Некорректный формат';
    default:
      return issue.message;
  }
}
