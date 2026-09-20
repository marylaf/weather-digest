export type Units = 'metric' | 'imperial';

export interface AppConfig {
  geocodingUrl: string;
  forecastUrl: string;
  timeoutMs: number;
  reportsDir: string;
  units: Units;
  port: number;
  nodeEnv: string;
  equipmentFile: string;
  requestsFile: string;
}
