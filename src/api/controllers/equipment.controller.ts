import type { Request, Response } from 'express';
import type {
  CreateEquipmentInput,
  EquipmentListQuery,
  UpdateEquipmentInput,
} from '../../types/equipment.js';
import * as equipmentService from '../services/equipment.service.js';

export async function listEquipment(req: Request, res: Response): Promise<void> {
  const result = await equipmentService.listEquipment(req.query as EquipmentListQuery);
  res.status(200).json(result);
}

export async function createEquipment(req: Request, res: Response): Promise<void> {
  const data = await equipmentService.createEquipment(req.body as CreateEquipmentInput);
  res.status(201).location(`/api/equipment/${data.id}`).json({ data });
}

export async function getEquipmentById(req: Request, res: Response): Promise<void> {
  const data = await equipmentService.getEquipmentById(req.params.id as string);
  res.status(200).json({ data });
}

export async function getEquipmentWeather(req: Request, res: Response): Promise<void> {
  const data = await equipmentService.getEquipmentWeather(req.params.id as string);
  res.status(200).json({ data });
}

export async function updateEquipment(req: Request, res: Response): Promise<void> {
  const data = await equipmentService.updateEquipment(
    req.params.id as string,
    req.body as UpdateEquipmentInput,
  );
  res.status(200).json({ data });
}

export async function deleteEquipment(req: Request, res: Response): Promise<void> {
  await equipmentService.deleteEquipment(req.params.id as string);
  res.status(204).end();
}
