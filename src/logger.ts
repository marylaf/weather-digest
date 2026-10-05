import { Writable } from 'node:stream';
import pino from 'pino';
import { loadConfig } from './config/appConfig.js';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

const ERROR_LEVEL_NUMBER = 50;
const REDACTED = '[Redacted]';

const REDACT_PATHS = [
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'cookies',
  'secret',
  'apiKey',
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.authorization',
  '*.cookie',
  '*.cookies',
  '*.secret',
  '*.apiKey',
  '*.*.password',
  '*.*.passwordHash',
  '*.*.password_hash',
  '*.*.token',
  '*.*.accessToken',
  '*.*.refreshToken',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["set-cookie"]',
  'err.parameters',
  'err.sql',
  'err.parent',
  'err.original',
  'err.config.password',
];

const { nodeEnv } = loadConfig();

export const logger = pino(
  {
    level: readLogLevel(nodeEnv),
    redact: {
      paths: REDACT_PATHS,
      censor: REDACTED,
    },
    serializers: {
      err: serializeError,
    },
  },
  createLogStream(),
);

function readLogLevel(nodeEnv: string): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();

  if (!raw) {
    return nodeEnv === 'production' ? 'info' : 'debug';
  }

  if (!isLogLevel(raw)) {
    throw new Error(
      `Invalid environment variable: LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}`,
    );
  }

  return raw;
}

function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.some((level) => level === value);
}

function serializeError(error: Error): {
  type: string;
  message: string;
  stack?: string;
  code?: string;
} {
  if (!(error instanceof Error)) {
    return { type: 'Error', message: 'Unknown error' };
  }

  const serialized: { type: string; message: string; stack?: string; code?: string } = {
    type: error.name,
    message: error.message,
  };

  if (typeof error.stack === 'string') {
    serialized.stack = error.stack;
  }

  if ('code' in error && typeof error.code === 'string') {
    serialized.code = error.code;
  }

  return serialized;
}

/**
 * info и warn пишем в stdout, error и fatal — в stderr.
 * Docker забирает оба потока, а пароли и токены в сообщение не попадают:
 * их вырезает redact, а у ошибок остаётся только type, message, code и stack.
 */
function createLogStream(): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      const line = chunk.toString();
      const destination = isErrorRecord(line.trim()) ? process.stderr : process.stdout;
      destination.write(line);
      callback();
    },
  });
}

function isErrorRecord(line: string): boolean {
  try {
    const parsed: unknown = JSON.parse(line);

    if (!parsed || typeof parsed !== 'object' || !('level' in parsed)) {
      return false;
    }

    return typeof parsed.level === 'number' && parsed.level >= ERROR_LEVEL_NUMBER;
  } catch {
    return false;
  }
}
