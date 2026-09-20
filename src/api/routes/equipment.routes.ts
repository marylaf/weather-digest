import { Router } from 'express';
import {
  createEquipment,
  deleteEquipment,
  getEquipmentById,
  getEquipmentWeather,
  listEquipment,
  updateEquipment,
} from '../controllers/equipment.controller.js';
import { listRequestsByEquipmentId } from '../controllers/request.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import {
  createEquipmentBodySchema,
  equipmentIdParamsSchema,
  equipmentListQuerySchema,
  equipmentWeatherParamsSchema,
  updateEquipmentBodySchema,
} from '../validators/equipment.js';

const equipmentRouter = Router();

equipmentRouter.get(
  '/',
  validate({ query: equipmentListQuerySchema }),
  asyncHandler(listEquipment),
);
equipmentRouter.post(
  '/',
  validate({ body: createEquipmentBodySchema }),
  asyncHandler(createEquipment),
);
equipmentRouter.get(
  '/:id/requests',
  validate({ params: equipmentIdParamsSchema }),
  asyncHandler(listRequestsByEquipmentId),
);
equipmentRouter.get(
  '/:id/weather',
  validate({ params: equipmentWeatherParamsSchema }),
  asyncHandler(getEquipmentWeather),
);
equipmentRouter.get(
  '/:id',
  validate({ params: equipmentIdParamsSchema }),
  asyncHandler(getEquipmentById),
);
equipmentRouter.patch(
  '/:id',
  validate({ params: equipmentIdParamsSchema, body: updateEquipmentBodySchema }),
  asyncHandler(updateEquipment),
);
equipmentRouter.delete(
  '/:id',
  validate({ params: equipmentIdParamsSchema }),
  asyncHandler(deleteEquipment),
);

export { equipmentRouter };
