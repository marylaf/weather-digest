import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { loadConfig } from '../../config/appConfig.js';
import { API_KEY_HEADER, MUTATING_METHODS } from '../../config/constants.js';
import { UnauthorizedError } from '../../errors/httpErrors.js';

const mutatingMethods = new Set<string>(MUTATING_METHODS);

/**
 * Requires `X-API-Key` or `Authorization: Bearer <token>` for POST, PATCH and DELETE.
 * GET, HEAD and OPTIONS stay public.
 */
export const requireApiKey: RequestHandler = (req, res, next) => {
  if (!mutatingMethods.has(req.method)) {
    next();
    return;
  }

  const expected = loadConfig().apiKey;
  const provided = extractCredential(req.header(API_KEY_HEADER), req.header('authorization'));

  if (!expected || !provided || !secretsEqual(provided, expected)) {
    res.setHeader('WWW-Authenticate', 'ApiKey, Bearer');
    next(new UnauthorizedError());
    return;
  }

  next();
};

function extractCredential(
  apiKeyHeader: string | undefined,
  authorizationHeader: string | undefined,
): string | undefined {
  const apiKey = apiKeyHeader?.trim();
  if (apiKey) {
    return apiKey;
  }

  const authorization = authorizationHeader?.trim();
  const bearerMatch = authorization?.match(/^Bearer\s+(\S+)/i);
  return bearerMatch?.[1];
}

function secretsEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
