import type { Units } from './config.js';
import type { DailyForecast } from './forecast.js';

export interface CityWeather {
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  units: Units;
  forecast: DailyForecast[];
}

export interface CityWeatherSuccess {
  city: string;
  status: 'fulfilled';
  data: CityWeather;
}

export interface CityWeatherFailure {
  city: string;
  status: 'rejected';
  error: Error;
}

export type CityWeatherResult = CityWeatherSuccess | CityWeatherFailure;
