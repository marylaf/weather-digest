import 'dotenv/config';
import type { Server } from 'node:http';
import { loadConfig } from '../config/appConfig.js';
import { DEFAULT_SHUTDOWN_TIMEOUT_MS } from '../config/constants.js';
import { closeDatabase, connectDatabase } from '../db/database.js';
import { logger } from '../logger.js';
import { app } from './app.js';

const { port, accessTokenSecret, refreshTokenSecret } = loadConfig();

if (!accessTokenSecret || !refreshTokenSecret) {
  logger.error('Missing required environment variables: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET');
  process.exit(1);
}

const shutdownTimeoutMs = readShutdownTimeout();

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
  logger.info({ signal, timeoutMs: shutdownTimeoutMs }, 'Shutting down API');

  // Новые соединения больше не принимаем. Простаивающий keep-alive закрываем сразу,
  // активным запросам даём доработать до таймаута.
  server.closeIdleConnections();

  const forceTimer = setTimeout(() => {
    logger.error(
      { timeoutMs: shutdownTimeoutMs },
      'Active requests did not finish in time, closing remaining connections',
    );
    server.closeAllConnections();
  }, shutdownTimeoutMs);
  forceTimer.unref();

  try {
    await closeHttpServer(server);
    clearTimeout(forceTimer);
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    clearTimeout(forceTimer);
    logger.error({ err: error }, 'Failed to shut down API');
    await closeDatabase().catch((dbError: unknown) => {
      logger.error({ err: dbError }, 'Failed to close PostgreSQL');
    });
    process.exit(1);
  }
}

function closeHttpServer(httpServer: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function readShutdownTimeout(): number {
  const raw = process.env.SHUTDOWN_TIMEOUT_MS?.trim();

  if (!raw) {
    return DEFAULT_SHUTDOWN_TIMEOUT_MS;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Invalid environment variable: SHUTDOWN_TIMEOUT_MS must be a positive integer');
  }

  return parsed;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      logger.error({ err: error }, 'Failed to shut down API');
      process.exit(1);
    });
  });
}
