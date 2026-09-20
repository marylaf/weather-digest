export const EQUIPMENT_TYPES = ['turbine', 'inverter', 'sensor', 'substation'] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const EQUIPMENT_STATUSES = [
  'operational',
  'maintenance',
  'fault',
  'decommissioned',
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export const EQUIPMENT_SORT_FIELDS = [
  'name',
  'type',
  'status',
  'serialNumber',
  'installedAt',
] as const;
export type EquipmentSortField = (typeof EQUIPMENT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export interface GeoLocation {
  lat: number;
  lon: number;
}

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  serialNumber: string;
  location: GeoLocation;
  status: EquipmentStatus;
  installedAt: string;
}

export interface CreateEquipmentInput {
  name: string;
  type: EquipmentType;
  serialNumber: string;
  location: GeoLocation;
  status: EquipmentStatus;
  installedAt: string;
}

export interface UpdateEquipmentInput {
  name?: string;
  type?: EquipmentType;
  serialNumber?: string;
  location?: GeoLocation;
  status?: EquipmentStatus;
  installedAt?: string;
}

export interface EquipmentListQuery {
  status?: string;
  type?: string;
  installedFrom?: string;
  installedTo?: string;
  sortBy?: string;
  order?: string;
  page?: string;
  limit?: string;
}

export interface EquipmentListMeta {
  total: number;
  page: number;
  limit: number;
}

export interface EquipmentListResult {
  data: Equipment[];
  meta: EquipmentListMeta;
}

export function isEquipmentType(value: unknown): value is EquipmentType {
  return typeof value === 'string' && EQUIPMENT_TYPES.some((type) => type === value);
}

export function isEquipmentStatus(value: unknown): value is EquipmentStatus {
  return typeof value === 'string' && EQUIPMENT_STATUSES.some((status) => status === value);
}

export function isEquipmentSortField(value: unknown): value is EquipmentSortField {
  return typeof value === 'string' && EQUIPMENT_SORT_FIELDS.some((field) => field === value);
}

export function isSortOrder(value: unknown): value is SortOrder {
  return typeof value === 'string' && SORT_ORDERS.some((order) => order === value);
}
