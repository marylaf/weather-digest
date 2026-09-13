import { getCoordinates } from '../api/geocodingApi.js';
import { getForecast } from '../api/weatherApi.js';
import type { CityWeather, CityWeatherResult } from '../types/weather.js';

export async function getWeatherForCity(city: string, days: number): Promise<CityWeather> {
  const location = await getCoordinates(city);
  const forecast = await getForecast(location.latitude, location.longitude, days);

  return {
    city: location.name,
    country: location.country,
    coordinates: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    forecast,
  };
}

export async function getWeatherForCities(
  cities: string[],
  days: number,
): Promise<CityWeatherResult[]> {
  const settled = await Promise.allSettled(
    cities.map((city) => getWeatherForCity(city, days)),
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
