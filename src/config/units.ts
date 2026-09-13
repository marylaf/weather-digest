import type { Units } from '../types/config.js';
import { DEFAULT_UNITS } from './constants.js';

export function parseUnits(raw: string | undefined): Units {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_UNITS;
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized === 'metric' || normalized === 'imperial') {
    return normalized;
  }

  throw new Error('Invalid environment variable: UNITS must be "metric" or "imperial"');
}

export function isUnits(value: unknown): value is Units {
  return value === 'metric' || value === 'imperial';
}

export function getUnitLabels(units: Units): { temperature: string; precipitation: string } {
  if (units === 'imperial') {
    return { temperature: '°F', precipitation: 'in' };
  }

  return { temperature: '°C', precipitation: 'мм' };
}
