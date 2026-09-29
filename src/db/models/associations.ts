import { Equipment } from './equipment.js';
import { RequestSparePart } from './requestSparePart.js';
import { SparePart } from './sparePart.js';
import { EquipmentPassport } from './equipmentPassport.js';
import { MaintenanceRequest } from './maintenanceRequest.js';
import { RequestAssignee } from './requestAssignee.js';
import { RequestStatusHistory } from './requestStatusHistory.js';
import { Site } from './site.js';
import { Technician } from './technician.js';

/**
 * Регистрирует все связи один раз после Model.init.
 * Алиасы `as` не задаются: имена аксессоров — имена моделей Sequelize
 * (для hasMany — pluralize). `sourceKey` / `targetKey` не задаются:
 * все ссылки идут на первичный ключ `id`.
 * `through.unique: false`, потому что уникальность пары уже задана составным PK.
 */
export function applyAssociations(): void {
  Site.hasMany(Equipment, {
    foreignKey: 'siteId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  Equipment.belongsTo(Site, {
    foreignKey: 'siteId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  Equipment.hasOne(EquipmentPassport, {
    foreignKey: 'equipmentId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  EquipmentPassport.belongsTo(Equipment, {
    foreignKey: 'equipmentId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  Equipment.hasMany(MaintenanceRequest, {
    foreignKey: 'equipmentId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  MaintenanceRequest.belongsTo(Equipment, {
    foreignKey: 'equipmentId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  MaintenanceRequest.hasMany(RequestStatusHistory, {
    foreignKey: 'requestId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  RequestStatusHistory.belongsTo(MaintenanceRequest, {
    foreignKey: 'requestId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  MaintenanceRequest.belongsToMany(Technician, {
    through: { model: RequestAssignee, unique: false },
    foreignKey: 'requestId',
    otherKey: 'technicianId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  Technician.belongsToMany(MaintenanceRequest, {
    through: { model: RequestAssignee, unique: false },
    foreignKey: 'technicianId',
    otherKey: 'requestId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  MaintenanceRequest.hasMany(RequestAssignee, {
    foreignKey: 'requestId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  Technician.hasMany(RequestAssignee, {
    foreignKey: 'technicianId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  RequestAssignee.belongsTo(MaintenanceRequest, {
    foreignKey: 'requestId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  RequestAssignee.belongsTo(Technician, {
    foreignKey: 'technicianId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  MaintenanceRequest.belongsToMany(SparePart, {
    through: { model: RequestSparePart, unique: false },
    foreignKey: 'requestId',
    otherKey: 'sparePartId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  SparePart.belongsToMany(MaintenanceRequest, {
    through: { model: RequestSparePart, unique: false },
    foreignKey: 'sparePartId',
    otherKey: 'requestId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  MaintenanceRequest.hasMany(RequestSparePart, {
    foreignKey: 'requestId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  SparePart.hasMany(RequestSparePart, {
    foreignKey: 'sparePartId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  RequestSparePart.belongsTo(MaintenanceRequest, {
    foreignKey: 'requestId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  RequestSparePart.belongsTo(SparePart, {
    foreignKey: 'sparePartId',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
}
