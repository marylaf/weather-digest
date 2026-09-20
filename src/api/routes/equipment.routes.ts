import { Router } from 'express';
import {
  createEquipment,
  deleteEquipment,
  getEquipmentById,
  listEquipment,
  updateEquipment,
} from '../controllers/equipment.controller.js';
import { listRequestsByEquipmentId } from '../controllers/request.controller.js';

const equipmentRouter = Router();

equipmentRouter.get('/', listEquipment);
equipmentRouter.post('/', createEquipment);
equipmentRouter.get('/:id/requests', listRequestsByEquipmentId);
equipmentRouter.get('/:id', getEquipmentById);
equipmentRouter.patch('/:id', updateEquipment);
equipmentRouter.delete('/:id', deleteEquipment);

export { equipmentRouter };
