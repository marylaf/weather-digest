import { parseCliArgs } from './config/parseArgs.js';
import { formatCityError, formatWeather } from './format/consoleFormatter.js';
import { getWeatherDigests } from './services/digestService.js';

try {
  const options = parseCliArgs();
  const results = await getWeatherDigests(options.cities, options.days, options.noCache);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      console.log(formatWeather(result.data));
      console.log();
      continue;
    }

    console.log(formatCityError(result.city, result.error));
    console.log();
  }

  process.exitCode = results.some((result) => result.status === 'rejected') ? 1 : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error('Usage: npm start -- --city "Москва,Казань,Сочи" [--days 3] [--no-cache]');
  process.exitCode = 1;
}
