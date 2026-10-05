import 'dotenv/config';
import type { Server } from 'node:http';
import { loadConfig } from '../config/appConfig.js';
import { closeDatabase, connectDatabase } from '../db/database.js';
import { logger } from '../logger.js';
import { app } from './app.js';

const { port, accessTokenSecret, refreshTokenSecret } = loadConfig();

if (!accessTokenSecret || !refreshTokenSecret) {
  logger.error('Missing required environment variables: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET');
  process.exit(1);
}

for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    await connectDatabase();
    break;
  } catch (error) {
    if (attempt === 30) {
      const message = error instanceof Error ? error.message : 'Failed to connect to PostgreSQL';
      logger.error({ err: error }, message);
      process.exit(1);
    }

    logger.warn({ attempt }, 'PostgreSQL is not ready, retrying');
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  }
}

const server: Server = app.listen(port, () => {
  logger.info({ port }, `API listening on http://localhost:${port}`);
  logger.info(`Requests UI: http://localhost:${port}/`);
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Shutting down API');

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await closeDatabase();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      logger.error({ err: error }, 'Failed to shut down API');
      process.exit(1);
    });
  });
}
