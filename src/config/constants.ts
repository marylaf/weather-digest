export const DEFAULT_DAYS = 3;
export const MIN_DAYS = 1;
export const MAX_DAYS = 7;

export const DEFAULT_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const DEFAULT_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const DEFAULT_TIMEOUT_MS = 5_000;
export const DEFAULT_MAX_WIND_SPEED = 10;

export const REPORTS_DIR = './reports';
export const DEFAULT_UNITS = 'metric' as const;

export const DEFAULT_PORT = 3_000;
export const DEFAULT_NODE_ENV = 'development';
export const DEFAULT_EQUIPMENT_FILE = './data/equipment.json';
export const DEFAULT_REQUESTS_FILE = './data/requests.json';

export const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'] as const;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT_MAX = 100;
export const DEFAULT_JSON_BODY_LIMIT = '100kb';

export const API_KEY_HEADER = 'X-API-Key';
export const MUTATING_METHODS = ['POST', 'PATCH', 'DELETE'] as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const MAX_REQUEST_IMPORT_ITEMS = 100;
