import { Op, type Transaction } from 'sequelize';
import { RequestSparePart } from '../../db/models/requestSparePart.js';
import { SparePart as SparePartModel } from '../../db/models/sparePart.js';
import type { CreateSparePartInput, SparePart, SparePartListQuery } from '../../types/sparePart.js';
import { ensureDb, isUuid } from './db.js';
import {
  containsPattern,
  resolvePageWindow,
  resolveSortField,
  resolveSortOrder,
} from './listQuery.js';

const ATTRIBUTES = ['id', 'name', 'sku', 'stockQuantity'] as const;
const SORT_FIELDS = ['name', 'sku', 'stockQuantity'] as const;

export async function list(query: SparePartListQuery): Promise<{
  data: SparePart[];
  meta: { total: number; page: number; limit: number };
}> {
  ensureDb();
  const window = resolvePageWindow(query.page, query.limit);
  const sortBy = resolveSortField(query.sortBy, SORT_FIELDS, 'name');
  const order = resolveSortOrder(query.order);
  const where =
    query.q === undefined
      ? {}
      : {
          [Op.or]: [
            { name: { [Op.iLike]: containsPattern(query.q) } },
            { sku: { [Op.iLike]: containsPattern(query.q) } },
          ],
        };

  const total = await SparePartModel.count({ where });
  const rows = await SparePartModel.findAll({
    attributes: [...ATTRIBUTES],
    where,
    order: [[sortBy === 'stockQuantity' ? 'stockQuantity' : sortBy, order]],
    limit: window.limit,
    offset: window.offset,
  });

  return {
    data: rows.map(toSparePart),
    meta: { total, page: window.page, limit: window.limit },
  };
}

export async function findById(id: string): Promise<SparePart | null> {
  if (!isUuid(id)) {
    return null;
  }

  ensureDb();
  const row = await SparePartModel.findByPk(id, { attributes: [...ATTRIBUTES] });
  return row ? toSparePart(row) : null;
}

export async function create(id: string, input: CreateSparePartInput): Promise<SparePart> {
  ensureDb();
  await SparePartModel.create({
    id,
    name: input.name,
    sku: input.sku,
    stockQuantity: input.stockQuantity.toFixed(2),
  });
  const saved = await findById(id);

  if (!saved) {
    throw new Error('Spare part disappeared after insert');
  }

  return saved;
}

export async function lockById(
  id: string,
  transaction: Transaction,
): Promise<SparePartModel | null> {
  if (!isUuid(id)) {
    return null;
  }

  ensureDb();
  return SparePartModel.findByPk(id, {
    attributes: [...ATTRIBUTES],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

export async function remove(id: string): Promise<boolean> {
  if (!isUuid(id)) {
    return false;
  }

  ensureDb();
  const deleted = await SparePartModel.destroy({ where: { id } });
  return deleted > 0;
}

export async function issue(
  requestId: string,
  sparePartId: string,
  quantity: string,
  transaction: Transaction,
): Promise<void> {
  ensureDb();
  await RequestSparePart.create(
    {
      requestId,
      sparePartId,
      quantity,
    },
    { transaction },
  );
}

function toSparePart(row: SparePartModel): SparePart {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    stockQuantity: row.stockQuantity,
  };
}
