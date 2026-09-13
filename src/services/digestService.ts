import { getWeatherForCity } from './weatherService.js';
import { readReport, writeReport } from '../storage/reportStorage.js';
import type { CityWeather, CityWeatherResult } from '../types/weather.js';

export async function getWeatherDigest(
  city: string,
  days: number,
  noCache: boolean,
): Promise<CityWeather> {
  if (!noCache) {
    const cached = await readReport(city);
    if (cached !== null && cached.forecast.length >= days) {
      return {
        ...cached,
        forecast: cached.forecast.slice(0, days),
      };
    }
  }

  const weather = await getWeatherForCity(city, days);
  await writeReport(city, weather);
  return weather;
}

export async function getWeatherDigests(
  cities: string[],
  days: number,
  noCache: boolean,
): Promise<CityWeatherResult[]> {
  const settled = await Promise.allSettled(
    cities.map((city) => getWeatherDigest(city, days, noCache)),
  );

  return cities.map((city, index) => {
    const result = settled[index];

    if (result === undefined) {
      return {
        city,
        status: 'rejected',
        error: new Error('Не удалось получить результат обработки города'),
      };
    }

    if (result.status === 'fulfilled') {
      return { city, status: 'fulfilled', data: result.value };
    }

    const error =
      result.reason instanceof Error ? result.reason : new Error(String(result.reason));

    return { city, status: 'rejected', error };
  });
}
