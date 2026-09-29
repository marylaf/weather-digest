import { Router } from 'express';
import { getEquipmentLoad } from '../controllers/report.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { equipmentLoadQuerySchema } from '../validators/report.js';

const reportRouter = Router();

reportRouter.get(
  '/equipment-load',
  validate({ query: equipmentLoadQuerySchema, errorStatus: 400 }),
  asyncHandler(getEquipmentLoad),
);

export { reportRouter };
