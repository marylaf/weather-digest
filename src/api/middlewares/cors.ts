import type { CorsOptions } from 'cors';
import cors from 'cors';
import { loadConfig } from '../../config/appConfig.js';

const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'];

export function createCorsMiddleware() {
  const { corsOrigins } = loadConfig();
  const allowed = new Set(corsOrigins);

  const options: CorsOptions = {
    origin(origin, callback) {
      if (origin === undefined) {
        callback(null, true);
        return;
      }

      callback(null, allowed.has(origin));
    },
    methods: ALLOWED_METHODS,
    allowedHeaders: ['Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    optionsSuccessStatus: 204,
  };

  return cors(options);
}
