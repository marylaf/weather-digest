import type { Request, Response } from 'express';
import { checkDatabase } from '../../db/database.js';
import { logger } from '../../logger.js';

/**
 * Liveness: процесс жив и может ответить.
 * Состояние PostgreSQL здесь не проверяем.
 */
export function getLive(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok' });
}

/**
 * Readiness: можно ли принимать рабочие запросы.
 * Если база недоступна, процесс не падает — клиент получает 503 и status "not ready".
 */
export async function getReady(req: Request, res: Response): Promise<void> {
  try {
    await checkDatabase();
    res.status(200).json({ status: 'ok', database: 'up' });
  } catch (error) {
    logger.warn(
      { err: error, requestId: req.requestId },
      'PostgreSQL is unavailable, API is not ready',
    );
    res.status(503).json({ status: 'not ready', database: 'down' });
  }
}
