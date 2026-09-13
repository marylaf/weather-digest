import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config/appConfig.js';
import { DEFAULT_UNITS } from '../config/constants.js';
import { isUnits } from '../config/units.js';
import type { DailyForecast } from '../types/forecast.js';
import type { CityWeather } from '../types/weather.js';
import { isRecord } from '../utils/isRecord.js';

// eslint-disable-next-line no-control-regex -- strip C0 control characters from filenames
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function getReportsDirectory(): string {
  const { reportsDir } = loadConfig();
  return path.resolve(reportsDir);
}

export function getReportFileName(city: string, date: Date = new Date()): string {
  return `${sanitizeFileName(city)}-${formatLocalDate(date)}.json`;
}

export function getReportPath(city: string, date: Date = new Date()): string {
  return path.join(getReportsDirectory(), getReportFileName(city, date));
}

export async function readReport(city: string): Promise<CityWeather | null> {
  try {
    const contents = await readFile(getReportPath(city), 'utf8');
    return parseCityWeather(JSON.parse(contents));
  } catch {
    return null;
  }
}

export async function writeReport(city: string, report: CityWeather): Promise<void> {
  const directory = getReportsDirectory();
  await mkdir(directory, { recursive: true });
  await writeFile(getReportPath(city), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function sanitizeFileName(city: string): string {
  const sanitized = city.trim().replace(UNSAFE_FILENAME_CHARS, '_').replace(/^\.+/, '');
  return sanitized.length > 0 ? sanitized : 'city';
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseCityWeather(value: unknown): CityWeather | null {
  if (!isRecord(value) || typeof value.city !== 'string' || typeof value.country !== 'string') {
    return null;
  }

  if (!isRecord(value.coordinates)) {
    return null;
  }

  const { latitude, longitude } = value.coordinates;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  if (value.units !== undefined && !isUnits(value.units)) {
    return null;
  }

  if (!Array.isArray(value.forecast)) {
    return null;
  }

  const forecast: DailyForecast[] = [];

  for (const item of value.forecast) {
    const day = parseDailyForecast(item);
    if (day === null) {
      return null;
    }
    forecast.push(day);
  }

  return {
    city: value.city,
    country: value.country,
    coordinates: { latitude, longitude },
    units: isUnits(value.units) ? value.units : DEFAULT_UNITS,
    forecast,
  };
}

function parseDailyForecast(value: unknown): DailyForecast | null {
  if (!isRecord(value) || typeof value.date !== 'string') {
    return null;
  }

  const { minTemperature, maxTemperature, precipitation } = value;

  if (
    typeof minTemperature !== 'number' ||
    typeof maxTemperature !== 'number' ||
    typeof precipitation !== 'number' ||
    !Number.isFinite(minTemperature) ||
    !Number.isFinite(maxTemperature) ||
    !Number.isFinite(precipitation)
  ) {
    return null;
  }

  return {
    date: value.date,
    minTemperature,
    maxTemperature,
    precipitation,
  };
}
