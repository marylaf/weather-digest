import type { Request, Response } from 'express';
import type { EquipmentLoadQuery } from '../../types/report.js';
import * as reportService from '../services/report.service.js';

export async function getSiteSummary(req: Request, res: Response): Promise<void> {
  const data = await reportService.getSiteSummary(req.params.id as string);
  res.status(200).json({ data });
}

export async function getEquipmentLoad(req: Request, res: Response): Promise<void> {
  const data = await reportService.getEquipmentLoad(req.query as unknown as EquipmentLoadQuery);
  res.status(200).json({ data });
}
