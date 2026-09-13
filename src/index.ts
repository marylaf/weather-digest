import { parseCliArgs } from './config/parseArgs.js';
import { getWeatherForCities } from './services/weatherService.js';

try {
  const options = parseCliArgs();
  const results = await getWeatherForCities(options.cities, options.days);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      console.log(result.data);
      continue;
    }

    console.error(`${result.city}: ${result.error.message}`);
    if (result.error.cause !== undefined) {
      console.error(result.error.cause);
    }
  }

  if (results.some((result) => result.status === 'rejected')) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error('Usage: npm start -- --city "Москва,Казань,Сочи" [--days 3] [--no-cache]');
  process.exitCode = 1;
}
