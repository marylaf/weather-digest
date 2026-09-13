import type { AppConfig } from '../types/config.js';
import {
  DEFAULT_FORECAST_URL,
  DEFAULT_GEOCODING_URL,
  DEFAULT_TIMEOUT_MS,
} from './constants.js';

export function loadConfig(): AppConfig {
  return {
    geocodingUrl: process.env.GEOCODING_URL ?? DEFAULT_GEOCODING_URL,
    forecastUrl: process.env.FORECAST_URL ?? DEFAULT_FORECAST_URL,
    timeoutMs: Number(process.env.TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
}
