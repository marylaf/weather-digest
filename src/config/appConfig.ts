import type { AppConfig, CookieSameSite } from '../types/config.js';
import {
  DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_CORS_ORIGINS,
  DEFAULT_FORECAST_URL,
  DEFAULT_GEOCODING_URL,
  DEFAULT_JSON_BODY_LIMIT,
  DEFAULT_MAX_WIND_SPEED,
  DEFAULT_NODE_ENV,
  DEFAULT_PORT,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
  DEFAULT_TIMEOUT_MS,
  REPORTS_DIR,
} from './constants.js';
import { parseUnits } from './units.js';

export function loadConfig(): AppConfig {
  return {
    geocodingUrl: process.env.GEOCODING_URL ?? DEFAULT_GEOCODING_URL,
    forecastUrl: process.env.FORECAST_URL ?? DEFAULT_FORECAST_URL,
    timeoutMs: parsePositiveNumber(
      process.env.REQUEST_TIMEOUT_MS || process.env.TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
    maxWindSpeed: parseMaxWindSpeed(process.env.MAX_WIND_SPEED),
    reportsDir: process.env.REPORTS_DIR || REPORTS_DIR,
    units: parseUnits(process.env.UNITS),
    port: Number(process.env.PORT) || DEFAULT_PORT,
    nodeEnv: process.env.NODE_ENV || DEFAULT_NODE_ENV,
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    rateLimitWindowMs: parsePositiveInt(
      process.env.RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
      'RATE_LIMIT_WINDOW_MS',
    ),
    rateLimitMax: parsePositiveInt(
      process.env.RATE_LIMIT_MAX,
      DEFAULT_RATE_LIMIT_MAX,
      'RATE_LIMIT_MAX',
    ),
    jsonBodyLimit: process.env.JSON_BODY_LIMIT?.trim() || DEFAULT_JSON_BODY_LIMIT,
    apiKey: process.env.API_KEY?.trim() ?? '',
    ...readAuthConfig(),
  };
}

function readAuthConfig(): Pick<
  AppConfig,
  | 'accessTokenSecret'
  | 'refreshTokenSecret'
  | 'accessTokenTtlSeconds'
  | 'refreshTokenTtlSeconds'
  | 'cookieSecure'
  | 'cookieSameSite'
> {
  const cookieSecure = parseBoolean(
    process.env.COOKIE_SECURE,
    (process.env.NODE_ENV || DEFAULT_NODE_ENV) === 'production',
  );

  return {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET?.trim() ?? '',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET?.trim() ?? '',
    accessTokenTtlSeconds: parsePositiveInt(
      process.env.JWT_ACCESS_TTL_SECONDS,
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
      'JWT_ACCESS_TTL_SECONDS',
    ),
    refreshTokenTtlSeconds: parsePositiveInt(
      process.env.JWT_REFRESH_TTL_SECONDS,
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
      'JWT_REFRESH_TTL_SECONDS',
    ),
    cookieSecure,
    cookieSameSite: parseSameSite(process.env.COOKIE_SAMESITE, cookieSecure),
  };
}

export function isProduction(): boolean {
  return loadConfig().nodeEnv === 'production';
}

function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') {
    return [...DEFAULT_CORS_ORIGINS];
  }

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.includes('*')) {
    throw new Error('Invalid environment variable: CORS_ORIGINS must not include "*"');
  }

  if (origins.length === 0) {
    throw new Error('Invalid environment variable: CORS_ORIGINS must list at least one origin');
  }

  return origins;
}

function parseMaxWindSpeed(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_MAX_WIND_SPEED;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Invalid environment variable: MAX_WIND_SPEED must be a non-negative number');
  }

  return parsed;
}

function parsePositiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid environment variable: ${name} must be a positive integer`);
  }

  return parsed;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const value = raw.trim().toLowerCase();

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  throw new Error('Invalid environment variable: COOKIE_SECURE must be true or false');
}

function parseSameSite(raw: string | undefined, cookieSecure: boolean): CookieSameSite {
  if (raw === undefined || raw.trim() === '') {
    return 'lax';
  }

  const value = raw.trim().toLowerCase();

  if (value === 'lax' || value === 'strict' || value === 'none') {
    if (value === 'none' && !cookieSecure) {
      throw new Error(
        'Invalid environment variable: COOKIE_SAMESITE=none requires COOKIE_SECURE=true',
      );
    }

    return value;
  }

  throw new Error('Invalid environment variable: COOKIE_SAMESITE must be lax, strict, or none');
}

function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
