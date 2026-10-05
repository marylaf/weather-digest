import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../../errors/httpErrors.js';
import { verifyAccessToken } from '../services/auth.service.js';

const INVALID_ACCESS = 'Missing or invalid access token';

/**
 * Требует `Authorization: Bearer` с access token. Без токена или с refresh token — 401.
 */
export const requireAccessToken: RequestHandler = (req, res, next) => {
  const header = req.header('authorization')?.trim();
  const match = header?.match(/^Bearer\s+(\S+)$/i);

  if (!match?.[1]) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    next(new UnauthorizedError(INVALID_ACCESS));
    return;
  }

  try {
    req.user = verifyAccessToken(match[1]);
    next();
  } catch (error) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    next(error instanceof UnauthorizedError ? error : new UnauthorizedError(INVALID_ACCESS));
  }
};
