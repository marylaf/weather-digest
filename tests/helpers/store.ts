import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Client } from 'pg';

const require = createRequire(import.meta.url);

let ready: Promise<void> | undefined;

export async function resetStore(): Promise<void> {
  ready ??= prepareDatabase();
  await ready;
  const client = adminClient(databaseName());

  try {
    await client.connect();
    await client.query(`
      TRUNCATE TABLE
        request_assignees,
        request_status_history,
        maintenance_requests,
        equipment_passports,
        equipment,
        technicians,
        sites
      RESTART IDENTITY CASCADE
    `);
  } finally {
    await client.end();
  }
}

async function prepareDatabase(): Promise<void> {
  await ensureDatabase();
  await runNode('scripts/ensure-app-role.cjs');
  await runMigrations();
}

async function ensureDatabase(): Promise<void> {
  const name = databaseName();
  const client = new Client({
    host: requiredEnv('DB_HOST'),
    port: Number(requiredEnv('DB_PORT')),
    user: requiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: 'postgres',
  });

  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await client.end();
  }
}

function adminClient(database: string): Client {
  return new Client({
    host: requiredEnv('DB_HOST'),
    port: Number(requiredEnv('DB_PORT')),
    user: requiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database,
  });
}

function runNode(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    collect(child, resolve, reject, script);
  });
}

function runMigrations(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [require.resolve('sequelize-cli/lib/sequelize'), 'db:migrate'],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    collect(child, resolve, reject, 'db:migrate');
  });
}

function collect(
  child: ReturnType<typeof spawn>,
  resolve: () => void,
  reject: (error: Error) => void,
  label: string,
): void {
  let output = '';

  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.on('error', reject);
  child.on('exit', (code) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(`${label} exited with ${code}\n${output}`));
  });
}

function databaseName(): string {
  const name = requiredEnv('DB_NAME');

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error('Invalid database name in DB_NAME');
  }

  return name;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
