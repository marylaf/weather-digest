import type { Request, Response } from 'express';
import type { EquipmentListQuery } from '../../types/equipment.js';
import { HttpError } from '../errors/httpError.js';
import * as equipmentService from '../services/equipment.service.js';

export async function listEquipment(req: Request, res: Response): Promise<void> {
  const result = await equipmentService.listEquipment(parseListQuery(req.query));
  res.status(200).json(result);
}

export async function createEquipment(req: Request, res: Response): Promise<void> {
  const data = await equipmentService.createEquipment(req.body);
  res.status(201).location(`/api/equipment/${data.id}`).json({ data });
}

export async function getEquipmentById(req: Request, res: Response): Promise<void> {
  const data = await equipmentService.getEquipmentById(requireId(req));
  res.status(200).json({ data });
}

export async function updateEquipment(req: Request, res: Response): Promise<void> {
  const data = await equipmentService.updateEquipment(requireId(req), req.body);
  res.status(200).json({ data });
}

export async function deleteEquipment(req: Request, res: Response): Promise<void> {
  await equipmentService.deleteEquipment(requireId(req));
  res.status(204).end();
}

function requireId(req: Request): string {
  const id = req.params.id;

  if (typeof id !== 'string' || id.trim() === '') {
    throw new HttpError(400, 'Missing equipment id');
  }

  return id;
}

function parseListQuery(query: Request['query']): EquipmentListQuery {
  return {
    status: readQueryString(query.status),
    type: readQueryString(query.type),
    installedFrom: readQueryString(query.installedFrom),
    installedTo: readQueryString(query.installedTo),
    sortBy: readQueryString(query.sortBy),
    order: readQueryString(query.order),
    page: readQueryString(query.page),
    limit: readQueryString(query.limit),
  };
}

function readQueryString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim() !== '') {
    return value[0].trim();
  }

  return undefined;
}
