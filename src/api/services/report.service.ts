import { NotFoundError } from '../../errors/httpErrors.js';
import type {
  EquipmentLoadQuery,
  EquipmentLoadRow,
  SiteRequestSummary,
} from '../../types/report.js';
import * as reportRepository from '../repositories/report.repository.js';

export async function getSiteSummary(siteId: string): Promise<SiteRequestSummary> {
  const summary = await reportRepository.getSiteSummary(siteId);

  if (summary === null) {
    throw new NotFoundError('Site not found');
  }

  return summary;
}

/**
 * Query: `createdFrom` / `createdTo` (алиасы `dateFrom`/`from`, `dateTo`/`to`) и `minRequests`.
 * Период ограничивает заявки по `created_at`. `minRequests` применяется в HAVING.
 */
export async function getEquipmentLoad(query: EquipmentLoadQuery): Promise<EquipmentLoadRow[]> {
  return reportRepository.listEquipmentLoad(query);
}
