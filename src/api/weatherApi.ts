import { loadConfig } from '../config/appConfig.js';
import { InvalidApiResponseError } from '../errors/appError.js';
import type { DailyForecast } from '../types/forecast.js';
import { isRecord } from '../utils/isRecord.js';
import { httpGetJson } from './httpClient.js';

export async function getForecast(
  latitude: number,
  longitude: number,
  days: number,
): Promise<DailyForecast[]> {
  const { forecastUrl, units } = loadConfig();
  const url = new URL(forecastUrl);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
  );
  url.searchParams.set('forecast_days', String(days));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('temperature_unit', units === 'imperial' ? 'fahrenheit' : 'celsius');
  url.searchParams.set('precipitation_unit', units === 'imperial' ? 'inch' : 'mm');
  url.searchParams.set('wind_speed_unit', units === 'imperial' ? 'mph' : 'ms');

  const payload = await httpGetJson(url.toString());
  return parseForecastResponse(payload);
}

function parseForecastResponse(payload: unknown): DailyForecast[] {
  if (!isRecord(payload) || !isRecord(payload.daily)) {
    throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (прогноз)');
  }

  const { time, temperature_2m_min, temperature_2m_max, precipitation_sum, wind_speed_10m_max } =
    payload.daily;

  if (
    !Array.isArray(time) ||
    !Array.isArray(temperature_2m_min) ||
    !Array.isArray(temperature_2m_max) ||
    !Array.isArray(precipitation_sum) ||
    !Array.isArray(wind_speed_10m_max)
  ) {
    throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (прогноз)');
  }

  if (
    temperature_2m_min.length !== time.length ||
    temperature_2m_max.length !== time.length ||
    precipitation_sum.length !== time.length ||
    wind_speed_10m_max.length !== time.length
  ) {
    throw new InvalidApiResponseError(
      'Неожиданная структура ответа Open-Meteo (прогноз): массивы разной длины',
    );
  }

  const forecast: DailyForecast[] = [];

  for (let index = 0; index < time.length; index += 1) {
    const date = time[index];
    const minTemperature = temperature_2m_min[index];
    const maxTemperature = temperature_2m_max[index];
    const precipitation = precipitation_sum[index];
    const windSpeed = wind_speed_10m_max[index];

    if (
      typeof date !== 'string' ||
      typeof minTemperature !== 'number' ||
      typeof maxTemperature !== 'number' ||
      typeof precipitation !== 'number' ||
      typeof windSpeed !== 'number' ||
      !Number.isFinite(minTemperature) ||
      !Number.isFinite(maxTemperature) ||
      !Number.isFinite(precipitation) ||
      !Number.isFinite(windSpeed)
    ) {
      throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (прогноз)');
    }

    forecast.push({
      date,
      minTemperature,
      maxTemperature,
      precipitation,
      windSpeed,
    });
  }

  return forecast;
}
