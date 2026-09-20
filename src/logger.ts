import pino from 'pino';
import { loadConfig } from './config/appConfig.js';

const { nodeEnv } = loadConfig();

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'info' : 'debug'),
});
