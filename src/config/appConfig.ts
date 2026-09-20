import type { AppConfig } from '../types/config.js';
import {
  DEFAULT_EQUIPMENT_FILE,
  DEFAULT_FORECAST_URL,
  DEFAULT_GEOCODING_URL,
  DEFAULT_NODE_ENV,
  DEFAULT_PORT,
  DEFAULT_REQUESTS_FILE,
  DEFAULT_TIMEOUT_MS,
  REPORTS_DIR,
} from './constants.js';
import { parseUnits } from './units.js';

export function loadConfig(): AppConfig {
  return {
    geocodingUrl: process.env.GEOCODING_URL ?? DEFAULT_GEOCODING_URL,
    forecastUrl: process.env.FORECAST_URL ?? DEFAULT_FORECAST_URL,
    timeoutMs: Number(process.env.TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    reportsDir: process.env.REPORTS_DIR || REPORTS_DIR,
    units: parseUnits(process.env.UNITS),
    port: Number(process.env.PORT) || DEFAULT_PORT,
    nodeEnv: process.env.NODE_ENV || DEFAULT_NODE_ENV,
    equipmentFile: process.env.EQUIPMENT_FILE || DEFAULT_EQUIPMENT_FILE,
    requestsFile: process.env.REQUESTS_FILE || DEFAULT_REQUESTS_FILE,
  };
}
