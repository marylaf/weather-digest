export type Units = 'metric' | 'imperial';

export interface AppConfig {
  geocodingUrl: string;
  forecastUrl: string;
  timeoutMs: number;
  maxWindSpeed: number;
  reportsDir: string;
  units: Units;
  port: number;
  nodeEnv: string;
  equipmentFile: string;
  requestsFile: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  jsonBodyLimit: string;
  apiKey: string;
}
