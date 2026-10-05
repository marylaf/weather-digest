import { MemoryStore, rateLimit } from 'express-rate-limit';
import { loadConfig } from '../../config/appConfig.js';
import { LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS } from '../../config/constants.js';
import { RateLimitError } from '../../errors/httpErrors.js';

const { rateLimitWindowMs, rateLimitMax } = loadConfig();

export const apiRateLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  limit: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new RateLimitError());
  },
});

export const loginRateLimitStore = new MemoryStore();

/** Отдельный лимит попыток входа, не общий лимит /api. */
export const loginRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: LOGIN_RATE_LIMIT_MAX,
  store: loginRateLimitStore,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new RateLimitError('Too many login attempts'));
  },
});
