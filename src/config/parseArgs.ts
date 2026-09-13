import { parseArgs } from 'node:util';
import type { CliOptions } from '../types/cli.js';

const OPTIONS = {
  city: { type: 'string' },
  days: { type: 'string' },
} as const;

/**
 * Parses CLI arguments for the weather digest.
 * @param argv - Argument list, defaults to process.argv without the node/script prefix
 */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: OPTIONS,
    strict: true,
  });

  const city = values.city?.trim();
  if (!city) {
    throw new Error('Missing required argument: --city');
  }

  if (values.days === undefined) {
    throw new Error('Missing required argument: --days');
  }

  const days = Number.parseInt(values.days, 10);
  if (!Number.isInteger(days) || days < 1 || String(days) !== values.days.trim()) {
    throw new Error('Invalid argument: --days must be a positive integer');
  }

  return { city, days };
}
