import type { ErrorRequestHandler } from 'express';
import {
  HttpStatusError,
  InvalidApiResponseError,
  InvalidJsonError,
  NetworkError,
  TimeoutError,
} from '../../errors/appError.js';
import {
  ExternalServiceError,
  HttpAppError,
  PayloadTooLargeError,
  ValidationError,
} from '../../errors/httpErrors.js';
import { logger } from '../../logger.js';
import { isProduction } from '../../config/appConfig.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: readonly { field: string; message: string }[];
    requestId: string;
  };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = req.requestId;
  const mapped = mapError(err);

  if (mapped.status >= 500) {
    logger.error({ err, requestId }, mapped.logMessage);
  } else {
    logger.warn({ err, requestId }, mapped.logMessage);
  }

  const body: ErrorBody = {
    error: {
      code: mapped.code,
      message: mapped.message,
      requestId,
    },
  };

  if (mapped.details !== undefined && mapped.details.length > 0) {
    body.error.details = mapped.details;
  }

  res.status(mapped.status).json(body);
};

function mapError(err: unknown): {
  status: number;
  code: string;
  message: string;
  details?: readonly { field: string; message: string }[];
  logMessage: string;
} {
  if (err instanceof HttpAppError) {
    return {
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details,
      logMessage: err.message,
    };
  }

  if (isPayloadTooLarge(err)) {
    const error = new PayloadTooLargeError();
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      logMessage: error.message,
    };
  }

  if (isInvalidJson(err)) {
    const error = new ValidationError(
      [{ field: 'body', message: 'Некорректный JSON' }],
      'Некорректные данные запроса',
    );
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
      logMessage: error.message,
    };
  }

  if (isWeatherClientError(err)) {
    const error = new ExternalServiceError('Weather service is unavailable', { cause: err });
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      logMessage: err instanceof Error ? err.message : error.message,
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: isProduction() ? 'Internal server error' : unexpectedMessage(err),
    logMessage: unexpectedMessage(err),
  };
}

function unexpectedMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error';
}

function isPayloadTooLarge(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.too.large'
  );
}

function isInvalidJson(err: unknown): boolean {
  return err instanceof SyntaxError && 'body' in err;
}

function isWeatherClientError(err: unknown): boolean {
  return (
    err instanceof TimeoutError ||
    err instanceof NetworkError ||
    err instanceof HttpStatusError ||
    err instanceof InvalidJsonError ||
    err instanceof InvalidApiResponseError
  );
}
