import type { SortOrder } from './equipment.js';

export const REQUEST_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];

export const REQUEST_STATUSES = ['new', 'in_progress', 'done', 'rejected'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const OPEN_REQUEST_STATUSES = ['new', 'in_progress'] as const;
export type OpenRequestStatus = (typeof OPEN_REQUEST_STATUSES)[number];

export const REQUEST_SORT_FIELDS = [
  'title',
  'priority',
  'status',
  'createdAt',
  'plannedAt',
  'equipmentId',
] as const;
export type RequestSortField = (typeof REQUEST_SORT_FIELDS)[number];

export interface MaintenanceRequest {
  id: string;
  equipmentId: string;
  title: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  plannedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestInput {
  equipmentId: string;
  title: string;
  description: string;
  priority: RequestPriority;
  plannedAt?: string;
}

export interface UpdateRequestInput {
  title?: string;
  description?: string;
  priority?: RequestPriority;
  plannedAt?: string;
}

export interface RequestListQuery {
  status?: RequestStatus;
  priority?: RequestPriority;
  equipmentId?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: RequestSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export interface RequestListMeta {
  total: number;
  page: number;
  limit: number;
}

export interface RequestListResult {
  data: MaintenanceRequest[];
  meta: RequestListMeta;
}

export interface ImportRequestError {
  code: string;
  message: string;
  details?: readonly { field: string; message: string }[];
}

export interface ImportRequestSuccess {
  index: number;
  ok: true;
  data: MaintenanceRequest;
}

export interface ImportRequestFailure {
  index: number;
  ok: false;
  error: ImportRequestError;
}

export type ImportRequestItemResult = ImportRequestSuccess | ImportRequestFailure;

export interface ImportRequestsMeta {
  total: number;
  succeeded: number;
  failed: number;
}

export interface ImportRequestsResult {
  meta: ImportRequestsMeta;
  results: ImportRequestItemResult[];
}

export function isRequestPriority(value: unknown): value is RequestPriority {
  return typeof value === 'string' && REQUEST_PRIORITIES.some((priority) => priority === value);
}

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === 'string' && REQUEST_STATUSES.some((status) => status === value);
}

export function isOpenRequestStatus(value: unknown): value is OpenRequestStatus {
  return typeof value === 'string' && OPEN_REQUEST_STATUSES.some((status) => status === value);
}

export function isRequestSortField(value: unknown): value is RequestSortField {
  return typeof value === 'string' && REQUEST_SORT_FIELDS.some((field) => field === value);
}
