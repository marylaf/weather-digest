import 'dotenv/config';
import type { Server } from 'node:http';
import { loadConfig } from '../config/appConfig.js';
import { closeDatabase, connectDatabase } from '../db/database.js';
import { logger } from '../logger.js';
import { app } from './app.js';

const { port, apiKey } = loadConfig();

if (!apiKey) {
  logger.error('Missing required environment variable: API_KEY');
  process.exit(1);
}

try {
  await connectDatabase();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to connect to PostgreSQL';
  logger.error({ err: error }, message);
  process.exit(1);
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
