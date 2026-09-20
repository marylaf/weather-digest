import type { IncomingMessage } from 'node:http';
import type { Request } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from '../../logger.js';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as Request).requestId,
  customAttributeKeys: {
    reqId: 'requestId',
    responseTime: 'duration',
  },
  customProps: (req) => ({
    requestId: (req as Request).requestId,
  }),
  customLogLevel: (_req, res, error) => {
    if (error !== undefined || res.statusCode >= 500) {
      return 'error';
    }

    if (res.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      path: requestPath(req),
    }),
    res: (res) => ({
      status: res.statusCode,
    }),
  },
});

function requestPath(req: IncomingMessage): string {
  const originalUrl =
    'originalUrl' in req && typeof req.originalUrl === 'string' ? req.originalUrl : req.url;
  const url = originalUrl ?? '';
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}
