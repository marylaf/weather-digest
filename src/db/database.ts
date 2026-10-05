import { Sequelize } from 'sequelize';
import { logger } from '../logger.js';
import { initModels } from './models/index.js';

const DEFAULT_POOL_MAX = 5;
const DEFAULT_POOL_MIN = 0;
const DEFAULT_POOL_ACQUIRE_MS = 30_000;
const DEFAULT_POOL_IDLE_MS = 10_000;
const READINESS_TIMEOUT_MS = 3_000;

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  poolMax: number;
  poolMin: number;
  poolAcquireMs: number;
  poolIdleMs: number;
}

let sequelize: Sequelize | undefined;

export function getSequelize(): Sequelize {
  if (!sequelize) {
    const config = loadDatabaseConfig();
    sequelize = createSequelize(config);
  }

  return sequelize;
}

export function loadDatabaseConfig(): DatabaseConfig {
  const poolMax = readOptionalInt('DB_POOL_MAX', DEFAULT_POOL_MAX, 1);
  const poolMin = readOptionalInt('DB_POOL_MIN', DEFAULT_POOL_MIN, 0);

  if (poolMin > poolMax) {
    throw new Error('Invalid environment variable: DB_POOL_MIN must not exceed DB_POOL_MAX');
  }

  return {
    host: readRequiredEnv('DB_HOST'),
    port: readRequiredPort('DB_PORT'),
    name: readRequiredEnv('DB_NAME'),
    user: readRequiredEnv('DB_APP_USER'),
    password: readRequiredSecret('DB_APP_PASSWORD'),
    poolMax,
    poolMin,
    poolAcquireMs: readOptionalInt('DB_POOL_ACQUIRE_MS', DEFAULT_POOL_ACQUIRE_MS, 1),
    poolIdleMs: readOptionalInt('DB_POOL_IDLE_MS', DEFAULT_POOL_IDLE_MS, 1),
  };
}

/**
 * Проверка PostgreSQL для readiness.
 * Соединение не закрываем: временный сбой не должен ронять пул и процесс.
 */
export async function checkDatabase(): Promise<void> {
  const pending = getSequelize().authenticate();
  // Если таймаут сработает раньше, отказ authenticate не должен стать unhandled rejection.
  void pending.catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('PostgreSQL readiness check timed out'));
        }, READINESS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function connectDatabase(): Promise<void> {
  const config = loadDatabaseConfig();
  const db = getSequelize();

  try {
    await db.authenticate();
  } catch (error) {
    await disposeSequelize().catch(() => undefined);
    throw new Error(
      `PostgreSQL is unavailable at ${config.host}:${config.port}/${config.name}: ${describeError(error)}`,
      { cause: error },
    );
  }

  initModels(db);

  logger.info(
    { host: config.host, port: config.port, database: config.name },
    'PostgreSQL connection established',
  );
}

export async function closeDatabase(): Promise<void> {
  if (!sequelize) {
    return;
  }

  await disposeSequelize();
  logger.info('PostgreSQL connection closed');
}

async function disposeSequelize(): Promise<void> {
  if (!sequelize) {
    return;
  }

  const connection = sequelize;
  sequelize = undefined;
  await connection.close();
}

function createSequelize(config: DatabaseConfig): Sequelize {
  return new Sequelize(config.name, config.user, config.password, {
    host: config.host,
    port: config.port,
    dialect: 'postgres',
    logging: (message) => {
      logger.debug(message);
    },
    pool: {
      max: config.poolMax,
      min: config.poolMin,
      acquire: config.poolAcquireMs,
      idle: config.poolIdleMs,
    },
  });
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readRequiredSecret(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readRequiredPort(name: string): number {
  const raw = readRequiredEnv(name);
  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid environment variable: ${name} must be an integer from 1 to 65535`);
  }

  return port;
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parent = 'parent' in error ? error.parent : undefined;
  const parentMessage = parent instanceof Error ? parent.message.trim() : '';
  const code = readErrorCode(error) || readErrorCode(parent);
  const message = error.message.trim() || parentMessage || error.name;

  return code && !message.includes(code) ? `${message} (${code})` : message;
}

function readErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return '';
  }

  return typeof error.code === 'string' ? error.code : '';
}

function readOptionalInt(name: string, fallback: number, minimum: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(
      `Invalid environment variable: ${name} must be an integer greater than or equal to ${minimum}`,
    );
  }

  return parsed;
}
