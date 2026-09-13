import { parseArgs } from 'node:util';
import type { CliOptions } from '../types/cli.js';
import { DEFAULT_DAYS, MAX_DAYS, MIN_DAYS } from './constants.js';

const OPTIONS = {
  city: { type: 'string' },
  days: { type: 'string' },
  'no-cache': { type: 'boolean', default: false },
} as const;

export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: OPTIONS,
    strict: true,
  });

  const cities = parseCities(values.city);
  const days = parseDays(values.days);

  return {
    cities,
    days,
    noCache: values['no-cache'] ?? false,
  };
}

function parseCities(rawCity: string | undefined): string[] {
  const cities = rawCity
    ?.split(',')
    .map((city) => city.trim())
    .filter((city) => city.length > 0);

  if (!cities?.length) {
    throw new Error('Missing required argument: --city');
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
      `Invalid argument: --days must be an integer between ${MIN_DAYS} and ${MAX_DAYS}`,
    );
  }

  return days;
}
