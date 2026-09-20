import type { Units } from './config.js';
import type { DailyForecast } from './forecast.js';
import type { Coordinates } from './geocoding.js';

export interface WeatherForecast {
  coordinates: Coordinates;
  units: Units;
  forecast: DailyForecast[];
}

export interface CityWeather extends WeatherForecast {
  city: string;
  country: string;
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
