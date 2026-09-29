'use strict';

const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Создаёт роль приложения до миграций.
 * CREATE ROLE нельзя выполнить внутри транзакции sequelize-cli.
 */
async function main() {
  const owner = required('DB_USER');
  const database = identifier('DB_NAME', required('DB_NAME'));
  const appUser = identifier('DB_APP_USER', required('DB_APP_USER'));
  const appPassword = quoteLiteral(requiredSecret('DB_APP_PASSWORD'));
  const client = new Client({
    host: required('DB_HOST'),
    port: Number(required('DB_PORT')),
    user: owner,
    password: requiredSecret('DB_PASSWORD'),
    database,
  });

  await client.connect();

  try {
    await withRoleLock(client, async () => {
      const existing = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser]);

      if (existing.rowCount === 0) {
        await client.query(`CREATE ROLE "${appUser}" LOGIN PASSWORD ${appPassword}`);
      }

      await client.query(`GRANT CONNECT ON DATABASE "${database}" TO "${appUser}"`);
      await client.query(`GRANT USAGE ON SCHEMA public TO "${appUser}"`);
    });
  } finally {
    await client.end();
  }
}

async function withRoleLock(client, work) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await client.query('SELECT pg_advisory_lock(84215045)');

      try {
        await work();
      } finally {
        await client.query('SELECT pg_advisory_unlock(84215045)');
      }

      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!/tuple concurrently updated|duplicate key value/i.test(message) || attempt === 4) {
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 40 * (attempt + 1));
      });
    }
  }
}

function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function requiredSecret(name) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function identifier(name, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`${name} must be a PostgreSQL identifier`);
  }

  return value;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
