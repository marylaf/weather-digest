'use strict';

const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function readRequired(name) {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return name === 'DB_PASSWORD' ? value : value.trim();
}

function readPort(name) {
  const port = Number(readRequired(name));

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid environment variable: ${name} must be an integer from 1 to 65535`);
  }

  return port;
}

const config = {
  username: readRequired('DB_USER'),
  password: readRequired('DB_PASSWORD'),
  database: readRequired('DB_NAME'),
  host: readRequired('DB_HOST'),
  port: readPort('DB_PORT'),
  dialect: 'postgres',
};

module.exports = {
  development: config,
  test: config,
  production: config,
};
