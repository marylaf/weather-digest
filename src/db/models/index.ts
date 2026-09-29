import type { Sequelize } from 'sequelize';
import { applyAssociations } from './associations.js';
import { initEquipmentModel } from './equipment.js';
import { initEquipmentPassportModel } from './equipmentPassport.js';
import { initMaintenanceRequestModel } from './maintenanceRequest.js';
import { initRequestAssigneeModel } from './requestAssignee.js';
import { initRequestSparePartModel } from './requestSparePart.js';
import { initRequestStatusHistoryModel } from './requestStatusHistory.js';
import { initSparePartModel } from './sparePart.js';
import { initSiteModel } from './site.js';
import { initTechnicianModel } from './technician.js';

export { Equipment } from './equipment.js';
export { EquipmentPassport } from './equipmentPassport.js';
export { MaintenanceRequest } from './maintenanceRequest.js';
export { RequestAssignee, ASSIGNEE_ROLES } from './requestAssignee.js';
export { RequestSparePart } from './requestSparePart.js';
export { SparePart } from './sparePart.js';
export type { AssigneeRole } from './requestAssignee.js';
export { RequestStatusHistory } from './requestStatusHistory.js';
export { Site } from './site.js';
export { Technician } from './technician.js';

let boundSequelize: Sequelize | undefined;

/**
 * Инициализирует модели и связи на экземпляре Sequelize.
 * Повторный вызов с тем же экземпляром ничего не делает.
 */
export function initModels(sequelize: Sequelize): void {
  if (boundSequelize === sequelize) {
    return;
  }

  if (boundSequelize) {
    throw new Error('Sequelize models are already registered on a different connection');
  }

  initSiteModel(sequelize);
  initEquipmentModel(sequelize);
  initEquipmentPassportModel(sequelize);
  initTechnicianModel(sequelize);
  initMaintenanceRequestModel(sequelize);
  initRequestStatusHistoryModel(sequelize);
  initRequestAssigneeModel(sequelize);
  initSparePartModel(sequelize);
  initRequestSparePartModel(sequelize);
  applyAssociations();
  boundSequelize = sequelize;
}
