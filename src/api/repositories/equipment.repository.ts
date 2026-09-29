import { Op, literal, type Order, type Transaction, type WhereOptions } from 'sequelize';
import { isUniqueConstraint } from '../../errors/databaseErrors.js';
import type {
  Equipment,
  EquipmentListQuery,
  EquipmentListResult,
  EquipmentSortField,
  GeoLocation,
} from '../../types/equipment.js';
import { EQUIPMENT_SORT_FIELDS } from '../../types/equipment.js';
import { Equipment as EquipmentModel } from '../../db/models/equipment.js';
import { EquipmentPassport } from '../../db/models/equipmentPassport.js';
import { Site } from '../../db/models/site.js';
import { ensureDb, isUuid } from './db.js';
import {
  containsPattern,
  resolvePageWindow,
  resolveSortField,
  resolveSortOrder,
} from './listQuery.js';
import { hideRequestsForEquipment } from './request.repository.js';

const EQUIPMENT_ATTRIBUTES = [
  'id',
  'name',
  'type',
  'serialNumber',
  'status',
  'installationDate',
] as const;

const SITE_ATTRIBUTES = ['id', 'latitude', 'longitude'] as const;

const PASSPORT_ATTRIBUTES = [
  'id',
  'manufacturer',
  'model',
  'nominalPower',
  'lastVerificationDate',
] as const;

const EQUIPMENT_ORDER_SQL: Record<EquipmentSortField, string> = {
  name: '"name"',
  type: '"type"::text',
  status: '"status"::text',
  serialNumber: '"serial_number"',
  installedAt: '"installation_date"',
};

const DEFAULT_SORT: EquipmentSortField = 'name';

/**
 * Список оборудования: WHERE / ORDER BY / LIMIT / OFFSET в PostgreSQL.
 * Паспорт подтягивается одним JOIN, без запроса на каждую строку.
 */
export async function list(query: EquipmentListQuery): Promise<EquipmentListResult> {
  ensureDb();
  const window = resolvePageWindow(query.page, query.limit);
  const sortBy = resolveSortField(query.sortBy, EQUIPMENT_SORT_FIELDS, DEFAULT_SORT);
  const order = resolveSortOrder(query.order);
  const where = equipmentWhere(query);

  const total = await EquipmentModel.count({ where });
  const rows = await EquipmentModel.findAll({
    ...equipmentQuery(),
    where,
    order: equipmentOrder(sortBy, order),
    limit: window.limit,
    offset: window.offset,
    subQuery: false,
  });

  return {
    data: rows.map((row) => toEquipment(row)),
    meta: { total, page: window.page, limit: window.limit },
  };
}

export async function findById(id: string): Promise<Equipment | null> {
  if (!isUuid(id)) {
    return null;
  }

  ensureDb();
  const row = await EquipmentModel.findByPk(id, equipmentQuery());
  return row ? toEquipment(row) : null;
}

export async function findBySerialNumber(serialNumber: string): Promise<Equipment | null> {
  ensureDb();
  const row = await EquipmentModel.findOne({
    ...equipmentQuery(),
    where: { serialNumber },
  });
  return row ? toEquipment(row) : null;
}

export async function create(equipment: Equipment): Promise<Equipment> {
  const sequelize = ensureDb();

  return sequelize.transaction(async (transaction) => {
    const site = await findOrCreateSite(equipment.location, transaction);
    await EquipmentModel.create(
      {
        id: equipment.id,
        siteId: site.id,
        name: equipment.name,
        type: equipment.type,
        serialNumber: equipment.serialNumber,
        status: equipment.status,
        installationDate: toDateOnly(equipment.installedAt),
      },
      { transaction },
    );

    const saved = await EquipmentModel.findByPk(equipment.id, { ...equipmentQuery(), transaction });

    if (!saved) {
      throw new Error('Equipment disappeared after insert');
    }

    return toEquipment(saved);
  });
}

export async function update(equipment: Equipment): Promise<Equipment | null> {
  if (!isUuid(equipment.id)) {
    return null;
  }

  const sequelize = ensureDb();

  return sequelize.transaction(async (transaction) => {
    const current = await EquipmentModel.findByPk(equipment.id, {
      attributes: ['id', 'siteId'],
      include: [{ model: Site, attributes: [...SITE_ATTRIBUTES], required: true }],
      transaction,
    });

    if (!current?.Site) {
      return null;
    }

    const site = sameCoordinates(current.Site, equipment.location)
      ? current.Site
      : await findOrCreateSite(equipment.location, transaction);

    await current.update(
      {
        siteId: site.id,
        name: equipment.name,
        type: equipment.type,
        serialNumber: equipment.serialNumber,
        status: equipment.status,
        installationDate: toDateOnly(equipment.installedAt),
      },
      { transaction },
    );

    const saved = await EquipmentModel.findByPk(equipment.id, { ...equipmentQuery(), transaction });
    return saved ? toEquipment(saved) : null;
  });
}

export async function remove(id: string): Promise<boolean> {
  if (!isUuid(id)) {
    return false;
  }

  const sequelize = ensureDb();

  return sequelize.transaction(async (transaction) => {
    const existing = await EquipmentModel.findByPk(id, { attributes: ['id'], transaction });

    if (!existing) {
      return false;
    }

    await hideRequestsForEquipment(id, transaction);
    const deleted = await EquipmentModel.destroy({ where: { id }, transaction });
    return deleted > 0;
  });
}

function equipmentQuery() {
  return {
    attributes: [...EQUIPMENT_ATTRIBUTES],
    include: [
      {
        model: Site,
        attributes: [...SITE_ATTRIBUTES],
        required: true,
      },
      {
        model: EquipmentPassport,
        attributes: [...PASSPORT_ATTRIBUTES],
        required: false,
      },
    ],
  };
}

function equipmentWhere(query: EquipmentListQuery): WhereOptions {
  const filters: WhereOptions[] = [];

  if (query.status !== undefined) {
    filters.push({ status: query.status });
  }

  if (query.type !== undefined) {
    filters.push({ type: query.type });
  }

  const installed = dateRange(query.installedFrom, query.installedTo);

  if (installed !== undefined) {
    filters.push({ installationDate: installed });
  }

  if (query.q !== undefined) {
    const pattern = containsPattern(query.q);
    filters.push({
      [Op.or]: [{ name: { [Op.iLike]: pattern } }, { serialNumber: { [Op.iLike]: pattern } }],
    });
  }

  return combineFilters(filters);
}

function combineFilters(filters: WhereOptions[]): WhereOptions {
  if (filters.length === 0) {
    return {};
  }

  if (filters.length === 1) {
    return filters[0] ?? {};
  }

  return { [Op.and]: filters };
}

function dateRange(
  from: string | undefined,
  to: string | undefined,
): Record<symbol, string> | undefined {
  if (from === undefined && to === undefined) {
    return undefined;
  }

  return {
    ...(from !== undefined ? { [Op.gte]: toDateOnly(from) } : {}),
    ...(to !== undefined ? { [Op.lte]: toDateOnly(to) } : {}),
  };
}

function equipmentOrder(sortBy: EquipmentSortField, order: 'asc' | 'desc'): Order {
  return sqlOrder('Equipment', EQUIPMENT_ORDER_SQL[sortBy], order);
}

function sqlOrder(alias: string, columnSql: string, order: 'asc' | 'desc'): Order {
  const direction = order === 'desc' ? 'DESC' : 'ASC';
  const nulls = order === 'asc' ? 'NULLS FIRST' : 'NULLS LAST';

  return [literal(`"${alias}".${columnSql} ${direction} ${nulls}`), literal(`"${alias}"."id" ASC`)];
}

function toEquipment(row: EquipmentModel): Equipment {
  const site = row.Site;

  if (!site) {
    throw new Error(`Equipment ${row.id} is missing its site`);
  }

  const passport = row.EquipmentPassport ?? null;

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    serialNumber: row.serialNumber,
    location: {
      lat: Number(site.latitude),
      lon: Number(site.longitude),
    },
    status: row.status,
    installedAt: formatDateOnly(row.installationDate),
    passport: passport
      ? {
          id: passport.id,
          manufacturer: passport.manufacturer,
          model: passport.model,
          nominalPower: passport.nominalPower,
          lastVerificationDate:
            passport.lastVerificationDate === null
              ? null
              : formatDateOnly(passport.lastVerificationDate),
        }
      : null,
  };
}

async function findOrCreateSite(location: GeoLocation, transaction: Transaction): Promise<Site> {
  const code = siteCode(location);
  const existing = await Site.findOne({ where: { code }, transaction });

  if (existing) {
    return existing;
  }

  const nested = await ensureDb().transaction({ transaction });

  try {
    const created = await Site.create(
      {
        name: siteName(location),
        code,
        region: 'не указан',
        latitude: location.lat.toFixed(6),
        longitude: location.lon.toFixed(6),
      },
      { transaction: nested },
    );
    await nested.commit();
    return created;
  } catch (error) {
    await nested.rollback();

    if (!isUniqueConstraint(error)) {
      throw error;
    }
  }

  const retry = await Site.findOne({ where: { code }, transaction });

  if (!retry) {
    throw new Error('Failed to resolve site for equipment location');
  }

  return retry;
}

function sameCoordinates(site: Site, location: GeoLocation): boolean {
  return (
    Number(site.latitude).toFixed(6) === location.lat.toFixed(6) &&
    Number(site.longitude).toFixed(6) === location.lon.toFixed(6)
  );
}

function siteCode(location: GeoLocation): string {
  return `api-${location.lat.toFixed(6)}-${location.lon.toFixed(6)}`;
}

function siteName(location: GeoLocation): string {
  return `Площадка ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
}

function formatDateOnly(value: string | Date): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateOnly(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value.slice(0, 10);
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}
