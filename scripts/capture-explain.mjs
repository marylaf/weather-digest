import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ quiet: true });

const database = process.argv[2] ?? process.env.DB_NAME;
const client = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database,
});

const siteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const equipmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const statusQuery = `
SELECT id
FROM equipment
WHERE deleted_at IS NULL
  AND status = 'fault'
  AND type = 'inverter'
`;

const nameQuery = `
SELECT id
FROM equipment
WHERE deleted_at IS NULL
  AND name ILIKE '%турбина 15000%'
`;

const requestQuery = `
SELECT id
FROM maintenance_requests
WHERE deleted_at IS NULL
  AND status = 'new'
ORDER BY created_at DESC
LIMIT 20
`;

await client.connect();

try {
  await client.query('BEGIN');
  await client.query(
    `
      INSERT INTO sites (id, name, code, region, latitude, longitude, created_at, updated_at)
      VALUES ($1, 'Explain site', 'EXPLAIN-TMP', 'demo', 0, 0, now(), now())
    `,
    [siteId],
  );
  await client.query(
    `
      INSERT INTO equipment (
        id, site_id, name, type, serial_number, status, installation_date, created_at, updated_at
      )
      VALUES ($1, $2, 'якорная турбина', 'turbine', 'EX-ANCHOR', 'operational', '2024-01-01', now(), now())
    `,
    [equipmentId, siteId],
  );
  await client.query(
    `
      INSERT INTO equipment (
        site_id, name, type, serial_number, status, installation_date, created_at, updated_at
      )
      SELECT
        $1,
        'турбина ' || g,
        'turbine',
        'EX-' || g,
        'operational',
        '2024-01-01',
        now(),
        now()
      FROM generate_series(1, 20000) AS g
    `,
    [siteId],
  );
  await client.query(
    `
      INSERT INTO equipment (
        site_id, name, type, serial_number, status, installation_date, created_at, updated_at
      )
      SELECT
        $1,
        'инвертор ' || g,
        'inverter',
        'INV-' || g,
        'fault',
        '2024-01-01',
        now(),
        now()
      FROM generate_series(1, 40) AS g
    `,
    [siteId],
  );
  await client.query(
    `
      INSERT INTO maintenance_requests (
        equipment_id, title, description, priority, status, author, created_at, updated_at
      )
      SELECT
        $1,
        'заявка ' || g,
        'описание',
        'low',
        'new',
        'explain',
        now() - (g || ' seconds')::interval,
        now()
      FROM generate_series(1, 20000) AS g
    `,
    [equipmentId],
  );
  await client.query('ANALYZE equipment');
  await client.query('ANALYZE maintenance_requests');

  await printPair(
    'equipment status + type',
    'equipment_status_type_active_idx',
    `CREATE INDEX equipment_status_type_active_idx ON equipment (status, type) WHERE deleted_at IS NULL`,
    statusQuery,
  );
  await printPair(
    'equipment name ILIKE',
    'equipment_name_trgm_idx',
    `CREATE INDEX equipment_name_trgm_idx ON equipment USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL`,
    nameQuery,
  );
  await printPair(
    'requests by status ordered by created_at',
    'maintenance_requests_status_created_at_idx',
    `CREATE INDEX maintenance_requests_status_created_at_idx ON maintenance_requests (status, created_at DESC) WHERE deleted_at IS NULL`,
    requestQuery,
  );

  await client.query('ROLLBACK');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}

async function printPair(title, indexName, createSql, query) {
  process.stdout.write(`\n## ${title}\n\n### without ${indexName}\n\n`);
  await client.query(`DROP INDEX IF EXISTS ${indexName}`);
  process.stdout.write(await explain(query));
  process.stdout.write(`\n### with ${indexName}\n\n`);
  await client.query(createSql);
  await client.query('ANALYZE equipment');
  await client.query('ANALYZE maintenance_requests');
  process.stdout.write(await explain(query));
}

async function explain(query) {
  const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS) ${query}`);
  return `${result.rows.map((row) => row['QUERY PLAN']).join('\n')}\n`;
}
