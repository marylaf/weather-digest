import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../errors/httpError.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message } });
    return;
  }

  next(err);
};
