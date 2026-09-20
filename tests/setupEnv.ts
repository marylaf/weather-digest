import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const workerId = process.env.JEST_WORKER_ID ?? '0';
const dir = path.join(tmpdir(), `weather-digest-api-tests-${process.pid}-${workerId}`);

mkdirSync(dir, { recursive: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.API_KEY = 'test-api-key';
process.env.RATE_LIMIT_MAX = '10000';
process.env.EQUIPMENT_FILE = path.join(dir, 'equipment.json');
process.env.REQUESTS_FILE = path.join(dir, 'requests.json');
