import { Gauge } from 'prom-client';
import { QueryTypes } from 'sequelize';
import { getSequelize } from '../../db/database.js';
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../../types/request.js';
import { register } from '../middlewares/httpMetrics.js';

// Те же смыслы, что у отчёта площадки, только по всему сервису.
// Статусы и приоритеты уже есть в maintenance_requests.
// Время закрытия — от created_at до первой записи done/rejected в request_status_history.
// Нагрузка — число неудалённых заявок на имя оборудования, как requestCount в отчёте.

const requestsByStatus = new Gauge({
  name: 'maintenance_requests_current',
  help: 'Сколько неудалённых заявок сейчас в каждом статусе',
  labelNames: ['status'],
  registers: [register],
});

const requestsByPriority = new Gauge({
  name: 'maintenance_requests_by_priority',
  help: 'Сколько неудалённых заявок сейчас в каждом приоритете',
  labelNames: ['priority'],
  registers: [register],
});

const closeSeconds = new Gauge({
  name: 'maintenance_request_close_seconds',
  help: 'Среднее время от создания заявки до первого статуса done или rejected, в секундах',
  registers: [register],
});

const equipmentRequestCount = new Gauge({
  name: 'equipment_request_count',
  help: 'Сколько неудалённых заявок приходится на оборудование с таким именем',
  labelNames: ['equipment'],
  registers: [register],
});

const STATUS_SQL = `
  SELECT status AS name, COUNT(*)::text AS count
  FROM maintenance_requests
  WHERE deleted_at IS NULL
  GROUP BY status
`;

const PRIORITY_SQL = `
  SELECT priority AS name, COUNT(*)::text AS count
  FROM maintenance_requests
  WHERE deleted_at IS NULL
  GROUP BY priority
`;

// Как AVERAGE_CLOSE_SQL в отчёте, но без фильтра по площадке.
const CLOSE_SQL = `
  SELECT AVG(
    EXTRACT(EPOCH FROM (closed.closed_at - r.created_at))
  ) AS avg_seconds
  FROM maintenance_requests AS r
  INNER JOIN (
    SELECT
      request_status_history.request_id,
      MIN(request_status_history.created_at) AS closed_at
    FROM request_status_history
    WHERE request_status_history.new_status::text IN ('done', 'rejected')
    GROUP BY request_status_history.request_id
  ) AS closed ON closed.request_id = r.id
  WHERE r.status::text IN ('done', 'rejected')
    AND r.deleted_at IS NULL
`;

const EQUIPMENT_SQL = `
  SELECT e.name AS name, COUNT(r.id)::text AS count
  FROM equipment AS e
  LEFT JOIN maintenance_requests AS r
    ON r.equipment_id = e.id
   AND r.deleted_at IS NULL
  WHERE e.deleted_at IS NULL
  GROUP BY e.name
`;

interface NameCountRow {
  name: string;
  count: string;
}

interface AverageRow {
  avg_seconds: string | null;
}

// Если прошлый запрос к базе ещё висит, его результат уже не записываем.
let refreshGeneration = 0;

/**
 * Обновляет прикладные gauge перед отдачей /metrics.
 * Если база недоступна, вызывающий код ловит ошибку и всё равно отдаёт HTTP-метрики.
 */
export async function refreshBusinessMetrics(): Promise<void> {
  const generation = ++refreshGeneration;
  const db = getSequelize();

  const statusRows = await db.query<NameCountRow>(STATUS_SQL, { type: QueryTypes.SELECT });
  const priorityRows = await db.query<NameCountRow>(PRIORITY_SQL, { type: QueryTypes.SELECT });
  const closeRows = await db.query<AverageRow>(CLOSE_SQL, { type: QueryTypes.SELECT });
  const equipmentRows = await db.query<NameCountRow>(EQUIPMENT_SQL, { type: QueryTypes.SELECT });

  if (generation !== refreshGeneration) {
    return;
  }

  writeKnownCounts(requestsByStatus, 'status', REQUEST_STATUSES, statusRows);
  writeKnownCounts(requestsByPriority, 'priority', REQUEST_PRIORITIES, priorityRows);
  writeRows(equipmentRequestCount, 'equipment', equipmentRows);
  writeCloseSeconds(closeRows[0]?.avg_seconds);
}

function writeKnownCounts(
  gauge: Gauge<string>,
  labelName: string,
  known: readonly string[],
  rows: NameCountRow[],
): void {
  const counts = new Map<string, number>(known.map((name) => [name, 0]));

  for (const row of rows) {
    counts.set(row.name, toCount(row.count));
  }

  gauge.reset();

  for (const [name, count] of counts) {
    gauge.set({ [labelName]: name }, count);
  }
}

function writeRows(gauge: Gauge<string>, labelName: string, rows: NameCountRow[]): void {
  gauge.reset();

  for (const row of rows) {
    gauge.set({ [labelName]: row.name }, toCount(row.count));
  }
}

function writeCloseSeconds(value: string | null | undefined): void {
  closeSeconds.reset();

  if (value === null || value === undefined) {
    return;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    closeSeconds.set(seconds);
  }
}

function toCount(value: string): number {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}
