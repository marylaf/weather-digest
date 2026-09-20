import pino from 'pino';
import { loadConfig } from './config/appConfig.js';

const { nodeEnv } = loadConfig();

export const logger = pino({
  level: nodeEnv === 'production' ? 'info' : 'debug',
});
