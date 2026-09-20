import { getCoordinates } from '../api/geocodingApi.js';
import { getForecast } from '../api/weatherApi.js';
import { loadConfig } from '../config/appConfig.js';
import type { DailyForecast } from '../types/forecast.js';
import type { CityWeather, CityWeatherResult, WeatherForecast } from '../types/weather.js';

export async function getForecastByCoordinates(
  latitude: number,
  longitude: number,
  days: number,
): Promise<WeatherForecast> {
  const forecast = await getForecast(latitude, longitude, days);

  return {
    coordinates: {
      latitude,
      longitude,
    },
    units: loadConfig().units,
    forecast,
  };
}

export async function getWeatherForCity(city: string, days: number): Promise<CityWeather> {
  const location = await getCoordinates(city);
  const weather = await getForecastByCoordinates(location.latitude, location.longitude, days);

  return {
    city: location.name,
    country: location.country,
    ...weather,
  };
}

export async function getWeatherForCities(
  cities: string[],
  days: number,
): Promise<CityWeatherResult[]> {
  const settled = await Promise.allSettled(cities.map((city) => getWeatherForCity(city, days)));

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

    const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason));

    return { city, status: 'rejected', error };
  });
}

/**
 * Наружные работы пригодны, если в первый день прогноза нет осадков
 * и максимальная скорость ветра ниже порога из конфигурации.
 */
export function isOutdoorWorkSuitable(
  forecast: readonly DailyForecast[],
  maxWindSpeed: number,
): boolean {
  const day = forecast[0];

  if (day === undefined) {
    return false;
  }

  return day.precipitation === 0 && day.windSpeed < maxWindSpeed;
}
