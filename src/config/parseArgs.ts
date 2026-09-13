import { parseArgs } from 'node:util';
import type { CliOptions } from '../types/cli.js';
import { DEFAULT_DAYS, MAX_DAYS, MIN_DAYS } from './constants.js';

const OPTIONS = {
  city: { type: 'string' },
  days: { type: 'string' },
  'no-cache': { type: 'boolean' },
} as const;

export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: OPTIONS,
    strict: true,
  });

  const cities = parseCities(values.city ?? process.env.CITY);
  const days = parseDays(values.days ?? process.env.DAYS);

  return {
    cities,
    days,
    noCache: values['no-cache'] ?? parseEnvFlag(process.env.NO_CACHE, 'NO_CACHE'),
  };
}

function parseCities(rawCity: string | undefined): string[] {
  const cities = rawCity
    ?.split(',')
    .map((city) => city.trim())
    .filter((city) => city.length > 0);

  if (!cities?.length) {
    throw new Error('Missing required argument: --city or CITY');
  }

  return cities;
}

function parseDays(rawDays: string | undefined): number {
  if (rawDays === undefined) {
    return DEFAULT_DAYS;
  }

  const trimmed = rawDays.trim();
  const days = Number(trimmed);

  if (
    trimmed === '' ||
    !Number.isInteger(days) ||
    days < MIN_DAYS ||
    days > MAX_DAYS ||
    String(days) !== trimmed
  ) {
    throw new Error(
      `Invalid argument: --days or DAYS must be an integer between ${MIN_DAYS} and ${MAX_DAYS}`,
    );
  }

  return days;
}

function parseEnvFlag(raw: string | undefined, name: string): boolean {
  if (raw === undefined || raw.trim() === '') {
    return false;
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }

  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }

  throw new Error(`Invalid environment variable: ${name} must be a boolean`);
}
