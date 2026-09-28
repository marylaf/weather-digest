import type { FindOptions } from 'sequelize';
import { getSequelize } from '../database.js';
import { Equipment } from '../models/equipment.js';
import { EquipmentPassport } from '../models/equipmentPassport.js';
import { initModels } from '../models/index.js';
import { MaintenanceRequest } from '../models/maintenanceRequest.js';
import { RequestStatusHistory } from '../models/requestStatusHistory.js';
import { Site } from '../models/site.js';
import { Technician } from '../models/technician.js';

const equipmentAttributes = [
  'id',
  'siteId',
  'name',
  'type',
  'serialNumber',
  'status',
  'installationDate',
  'createdAt',
  'updatedAt',
] as const;

const siteAttributes = ['id', 'name', 'code', 'region', 'latitude', 'longitude'] as const;

const passportAttributes = [
  'id',
  'manufacturer',
  'model',
  'nominalPower',
  'lastVerificationDate',
] as const;

const maintenanceRequestAttributes = [
  'id',
  'equipmentId',
  'title',
  'description',
  'priority',
  'status',
  'plannedAt',
  'author',
  'createdAt',
  'updatedAt',
] as const;

const technicianAttributes = ['id', 'fullName', 'specialization', 'employeeNumber'] as const;

const statusHistoryAttributes = [
  'id',
  'oldStatus',
  'newStatus',
  'changedBy',
  'comment',
  'createdAt',
] as const;

/**
 * Оборудование и его паспорт одним JOIN.
 * Вложенный паспорт без timestamps и без повторяющегося `equipmentId`.
 */
export function equipmentWithPassportOptions(): FindOptions {
  return {
    attributes: [...equipmentAttributes],
    include: [
      {
        model: EquipmentPassport,
        attributes: [...passportAttributes],
        required: false,
      },
    ],
  };
}

/**
 * Список оборудования вместе с площадкой и паспортом.
 * belongsTo и hasOne попадают в один SELECT с JOIN, без запроса на каждую строку.
 */
export function equipmentListOptions(): FindOptions {
  return {
    attributes: [...equipmentAttributes],
    include: [
      {
        model: Site,
        attributes: [...siteAttributes],
        required: true,
      },
      {
        model: EquipmentPassport,
        attributes: [...passportAttributes],
        required: false,
      },
    ],
    order: [
      ['name', 'ASC'],
      ['id', 'ASC'],
    ],
  };
}

/**
 * Заявка и назначенные техники.
 * `role` и `hours` читаются из through-модели `RequestAssignee`.
 */
export function maintenanceRequestWithTechniciansOptions(): FindOptions {
  return {
    attributes: [...maintenanceRequestAttributes],
    include: [
      {
        model: Technician,
        attributes: [...technicianAttributes],
        through: {
          attributes: ['role', 'hours'],
        },
      },
    ],
    // `as` — имя связи по умолчанию (pluralize("Technician")), не отдельный alias.
    order: [[{ model: Technician, as: 'Technicians' }, 'fullName', 'ASC']],
  };
}

/**
 * Заявка и история статусов.
 * `separate: true` загружает историю одним дополнительным запросом `IN (...)`,
 * а не отдельным запросом на каждую заявку и без размножения строк заявки.
 */
export function maintenanceRequestWithStatusHistoryOptions(): FindOptions {
  return {
    attributes: [...maintenanceRequestAttributes],
    include: [
      {
        model: RequestStatusHistory,
        attributes: [...statusHistoryAttributes],
        separate: true,
        order: [['createdAt', 'ASC']],
      },
    ],
  };
}

export async function findEquipmentWithPassport(id: string): Promise<Equipment | null> {
  ensureModels();
  return Equipment.findByPk(id, equipmentWithPassportOptions());
}

export async function listEquipmentWithSiteAndPassport(): Promise<Equipment[]> {
  ensureModels();
  return Equipment.findAll(equipmentListOptions());
}

export async function findMaintenanceRequestWithTechnicians(
  id: string,
): Promise<MaintenanceRequest | null> {
  ensureModels();
  return MaintenanceRequest.findByPk(id, maintenanceRequestWithTechniciansOptions());
}

export async function findMaintenanceRequestWithStatusHistory(
  id: string,
): Promise<MaintenanceRequest | null> {
  ensureModels();
  return MaintenanceRequest.findByPk(id, maintenanceRequestWithStatusHistoryOptions());
}

function ensureModels(): void {
  initModels(getSequelize());
}
