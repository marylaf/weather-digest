import type { Request, Response } from 'express';
import type { CreateSparePartInput, SparePartListQuery } from '../../types/sparePart.js';
import * as sparePartService from '../services/sparePart.service.js';

export async function listSpareParts(req: Request, res: Response): Promise<void> {
  const result = await sparePartService.listSpareParts(req.query as SparePartListQuery);
  res.status(200).json(result);
}

export async function getSparePart(req: Request, res: Response): Promise<void> {
  const data = await sparePartService.getSparePart(req.params.id as string);
  res.status(200).json({ data });
}

export async function deleteSparePart(req: Request, res: Response): Promise<void> {
  await sparePartService.deleteSparePart(req.params.id as string);
  res.status(204).end();
}

export async function createSparePart(req: Request, res: Response): Promise<void> {
  const data = await sparePartService.createSparePart(req.body as CreateSparePartInput);
  res.status(201).location(`/api/spare-parts/${data.id}`).json({ data });
}
