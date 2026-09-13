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
  const { forecastUrl } = loadConfig();
  const url = new URL(forecastUrl);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
  url.searchParams.set('forecast_days', String(days));
  url.searchParams.set('timezone', 'auto');

  const payload = await httpGetJson(url.toString());
  return parseForecastResponse(payload);
}

function parseForecastResponse(payload: unknown): DailyForecast[] {
  if (!isRecord(payload) || !isRecord(payload.daily)) {
    throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (прогноз)');
  }

  const { time, temperature_2m_min, temperature_2m_max, precipitation_sum } = payload.daily;

  if (
    !Array.isArray(time) ||
    !Array.isArray(temperature_2m_min) ||
    !Array.isArray(temperature_2m_max) ||
    !Array.isArray(precipitation_sum)
  ) {
    throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (прогноз)');
  }

  if (
    temperature_2m_min.length !== time.length ||
    temperature_2m_max.length !== time.length ||
    precipitation_sum.length !== time.length
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

    if (
      typeof date !== 'string' ||
      typeof minTemperature !== 'number' ||
      typeof maxTemperature !== 'number' ||
      typeof precipitation !== 'number' ||
      !Number.isFinite(minTemperature) ||
      !Number.isFinite(maxTemperature) ||
      !Number.isFinite(precipitation)
    ) {
      throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (прогноз)');
    }

    forecast.push({
      date,
      minTemperature,
      maxTemperature,
      precipitation,
    });
  }

  return forecast;
}
