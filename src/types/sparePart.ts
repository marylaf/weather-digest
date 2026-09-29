import type { SortOrder } from './equipment.js';

export interface SparePart {
  id: string;
  name: string;
  sku: string;
  stockQuantity: string;
}

export interface CreateSparePartInput {
  name: string;
  sku: string;
  stockQuantity: number;
}

export interface IssueSparePartInput {
  sparePartId: string;
  quantity: number;
}

export interface RequestSparePartLine {
  id: string;
  name: string;
  sku: string;
  quantity: string;
}

export interface SparePartListQuery {
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'sku' | 'stockQuantity';
  order?: SortOrder;
}
