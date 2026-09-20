import { Router } from 'express';
import {
  createEquipment,
  deleteEquipment,
  getEquipmentById,
  listEquipment,
  updateEquipment,
} from '../controllers/equipment.controller.js';

const equipmentRouter = Router();

equipmentRouter.get('/', listEquipment);
equipmentRouter.post('/', createEquipment);
equipmentRouter.get('/:id', getEquipmentById);
equipmentRouter.patch('/:id', updateEquipment);
equipmentRouter.delete('/:id', deleteEquipment);

export { equipmentRouter };
