import { parseCliArgs } from './config/parseArgs.js';

try {
  const options = parseCliArgs();
  console.log(options);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error('Usage: npm start -- --city "Нижний Новгород" --days 3');
  process.exitCode = 1;
}
