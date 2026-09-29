import type { RequestPriority, RequestStatus } from './request.js';

export interface SiteRequestSummary {
  siteId: string;
  requestsByStatus: Record<RequestStatus, number>;
  requestsByPriority: Record<RequestPriority, number>;
  /** Среднее время от `created_at` до первого закрытия. `null`, если закрытых заявок нет. */
  averageCloseTimeSeconds: number | null;
}

/**
 * Период режет заявки по `maintenance_requests.created_at`.
 * `minRequests` уходит в HAVING и по умолчанию равен 0: оборудование без заявок остаётся в отчёте.
 */
export interface EquipmentLoadQuery {
  createdFrom?: Date;
  createdTo?: Date;
  minRequests: number;
}

export interface EquipmentLoadRow {
  equipmentId: string;
  name: string;
  requestCount: number;
  closedRequestCount: number;
  plannedLaborHours: string;
  lastMaintenanceAt: string | null;
}
