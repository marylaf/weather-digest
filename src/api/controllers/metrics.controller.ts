import type { Request, Response } from 'express';
import { logger } from '../../logger.js';
import { refreshBusinessMetrics } from '../metrics/businessMetrics.js';
import { register } from '../middlewares/httpMetrics.js';

const BUSINESS_METRICS_TIMEOUT_MS = 2_000;

/**
 * Prometheus забирает этот текст сам, из внутренней сети compose.
 * Снаружи путь закрыт basic auth в Nginx.
 */
export async function getMetrics(_req: Request, res: Response): Promise<void> {
  try {
    await readBusinessMetrics();
  } catch (error) {
    // База может лежать, а процесс при этом жив. HTTP-метрики всё равно отдаём,
    // иначе Prometheus решит, что упал весь API.
    logger.warn({ err: error }, 'Не удалось прочитать метрики из PostgreSQL');
  }

  res.setHeader('Content-Type', register.contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.send(await register.metrics());
}

async function readBusinessMetrics(): Promise<void> {
  const pending = refreshBusinessMetrics();
  // Таймаут не должен оставить отказ запроса необработанным.
  void pending.catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('PostgreSQL metrics timed out'));
        }, BUSINESS_METRICS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
