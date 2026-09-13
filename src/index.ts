import {
  DEFAULT_FORECAST_URL,
  DEFAULT_GEOCODING_URL,
  DEFAULT_TIMEOUT_MS,
} from './config/constants.js';
import { parseCliArgs } from './config/parseArgs.js';

try {
  const options = parseCliArgs();
  const config = {
    geocodingUrl: process.env.GEOCODING_URL ?? DEFAULT_GEOCODING_URL,
    forecastUrl: process.env.FORECAST_URL ?? DEFAULT_FORECAST_URL,
    timeoutMs: Number(process.env.TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
  console.log({ config, options });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error('Usage: npm start -- --city "Москва,Казань,Сочи" [--days 3] [--no-cache]');
  process.exitCode = 1;
}
