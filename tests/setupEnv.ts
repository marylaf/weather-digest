import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const workerId = process.env.JEST_WORKER_ID ?? '1';
const dir = path.join(tmpdir(), `weather-digest-api-tests-${process.pid}-${workerId}`);

mkdirSync(dir, { recursive: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.API_KEY = 'test-api-key';
process.env.RATE_LIMIT_MAX = '10000';
process.env.EQUIPMENT_FILE = path.join(dir, 'equipment.json');
process.env.REQUESTS_FILE = path.join(dir, 'requests.json');

fillEnv('DB_HOST', '127.0.0.1');
fillEnv('DB_PORT', '5432');
fillEnv('DB_USER', 'weather_digest');
fillEnv('DB_PASSWORD', 'change_me');
fillEnv('DB_APP_USER', 'weather_digest_app');
fillEnv('DB_APP_PASSWORD', 'change_me_app');
fillEnv('DB_NAME', 'weather_digest');

const baseName = (process.env.DB_NAME ?? 'weather_digest').trim().replace(/_test(?:_\d+)?$/, '');
process.env.DB_NAME = `${baseName}_test_${workerId}`;

function fillEnv(name: string, fallback: string): void {
  const current = process.env[name];

  if (current === undefined || current.trim() === '') {
    process.env[name] = fallback;
  }
}
