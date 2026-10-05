import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

// Только безопасные символы и ограниченная длина: так id можно писать в лог и в заголовок.
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id')?.trim();
  req.requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
