import 'dotenv/config';
import { loadConfig } from '../config/appConfig.js';
import { logger } from '../logger.js';
import { app } from './app.js';

const { port, apiKey } = loadConfig();

if (!apiKey) {
  logger.error('Missing required environment variable: API_KEY');
  process.exit(1);
}

app.listen(port, () => {
  logger.info({ port }, `API listening on http://localhost:${port}`);
});
