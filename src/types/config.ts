export type Units = 'metric' | 'imperial';
export type CookieSameSite = 'lax' | 'strict' | 'none';

export interface AppConfig {
  geocodingUrl: string;
  forecastUrl: string;
  timeoutMs: number;
  maxWindSpeed: number;
  reportsDir: string;
  units: Units;
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  jsonBodyLimit: string;
  apiKey: string;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  cookieSecure: boolean;
  cookieSameSite: CookieSameSite;
}
