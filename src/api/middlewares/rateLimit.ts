import { rateLimit } from 'express-rate-limit';
import { loadConfig } from '../../config/appConfig.js';
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
