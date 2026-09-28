import type { Sequelize } from 'sequelize';
import { getSequelize } from '../../db/database.js';
import { initModels } from '../../db/models/index.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function ensureDb(): Sequelize {
  const sequelize = getSequelize();
  initModels(sequelize);
  return sequelize;
}
