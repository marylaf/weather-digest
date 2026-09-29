import { randomUUID } from 'node:crypto';
import { isUniqueConstraint } from '../../errors/databaseErrors.js';
import { ConflictError, NotFoundError } from '../../errors/httpErrors.js';
import { ensureDb } from '../repositories/db.js';
import * as requestRepository from '../repositories/request.repository.js';
import * as sparePartRepository from '../repositories/sparePart.repository.js';
import type { MaintenanceRequest } from '../../types/request.js';
import type {
  CreateSparePartInput,
  IssueSparePartInput,
  SparePart,
  SparePartListQuery,
} from '../../types/sparePart.js';

export async function listSpareParts(query: SparePartListQuery) {
  return sparePartRepository.list(query);
}

export async function getSparePart(id: string): Promise<SparePart> {
  const part = await sparePartRepository.findById(id);

  if (!part) {
    throw new NotFoundError('Spare part not found');
  }

  return part;
}

export async function deleteSparePart(id: string): Promise<void> {
  const deleted = await sparePartRepository.remove(id);

  if (!deleted) {
    throw new NotFoundError('Spare part not found');
  }
}

export async function createSparePart(input: CreateSparePartInput): Promise<SparePart> {
  try {
    return await sparePartRepository.create(randomUUID(), input);
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new ConflictError('Spare part with this sku already exists');
    }

    throw error;
  }
}

/**
 * Списывает остаток и пишет строку расхода в одной транзакции.
 * Нехватка остатка и повторная выдача той же запчасти на заявку — 409, откат полный.
 */
export async function issueSparePart(
  requestId: string,
  input: IssueSparePartInput,
): Promise<MaintenanceRequest> {
  const sequelize = ensureDb();

  return sequelize.transaction(async (transaction) => {
    const request = await requestRepository.lockById(requestId, transaction);

    if (!request) {
      throw new NotFoundError('Maintenance request not found');
    }

    const part = await sparePartRepository.lockById(input.sparePartId, transaction);

    if (!part) {
      throw new NotFoundError('Spare part not found');
    }

    const stock = Number(part.stockQuantity);
    const quantity = input.quantity.toFixed(2);

    if (!Number.isFinite(stock) || stock < input.quantity) {
      throw new ConflictError('Not enough spare parts in stock');
    }

    await part.update({ stockQuantity: (stock - input.quantity).toFixed(2) }, { transaction });

    try {
      await sparePartRepository.issue(requestId, input.sparePartId, quantity, transaction);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ConflictError('Spare part is already issued to this request');
      }

      throw error;
    }

    const saved = await requestRepository.findById(requestId, transaction);

    if (!saved) {
      throw new NotFoundError('Maintenance request not found');
    }

    return saved;
  });
}
