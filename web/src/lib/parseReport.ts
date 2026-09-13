import type { CityWeather, DailyForecast } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

/** Проверяет, что JSON совпадает с сохранённым отчётом CLI. */
export function parseCityWeather(value: unknown): CityWeather | null {
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

  if (value.units !== undefined && value.units !== 'metric' && value.units !== 'imperial') {
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
    units: value.units === 'imperial' ? 'imperial' : 'metric',
    forecast,
  };
}
