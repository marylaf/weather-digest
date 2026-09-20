import 'dotenv/config';
import { loadConfig } from '../config/appConfig.js';
import { logger } from '../logger.js';
import { app } from './app.js';

const { port } = loadConfig();

app.listen(port, () => {
  logger.info({ port }, `API listening on http://localhost:${port}`);
});
