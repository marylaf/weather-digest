import {
  DataTypes,
  Model,
  literal,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../../types/request.js';
import type { Equipment } from './equipment.js';
import type { RequestAssignee } from './requestAssignee.js';
import type { RequestStatusHistory } from './requestStatusHistory.js';
import type { Technician } from './technician.js';

/**
 * Заявка на обслуживание. Таблица `maintenance_requests`.
 * Класс не подменяет API-тип `MaintenanceRequest` из `src/types/request.ts`.
 */
export class MaintenanceRequest extends Model<
  InferAttributes<MaintenanceRequest>,
  InferCreationAttributes<MaintenanceRequest>
> {
  declare id: CreationOptional<string>;
  declare equipmentId: ForeignKey<string>;
  declare title: string;
  declare description: string;
  declare priority: (typeof REQUEST_PRIORITIES)[number];
  declare status: (typeof REQUEST_STATUSES)[number];
  declare plannedAt: Date | null;
  declare author: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare Equipment?: NonAttribute<Equipment>;
  declare RequestStatusHistories?: NonAttribute<RequestStatusHistory[]>;
  declare Technicians?: NonAttribute<Technician[]>;
  declare RequestAssignees?: NonAttribute<RequestAssignee[]>;
}

export function initMaintenanceRequestModel(sequelize: Sequelize): void {
  MaintenanceRequest.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: literal('gen_random_uuid()'),
      },
      equipmentId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'equipment_id',
        references: { model: 'equipment', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      title: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { len: [0, 120] },
      },
      description: {
        type: DataTypes.STRING(2000),
        allowNull: false,
        validate: { len: [0, 2000] },
      },
      priority: {
        type: DataTypes.ENUM(...REQUEST_PRIORITIES),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...REQUEST_STATUSES),
        allowNull: false,
      },
      plannedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'planned_at',
      },
      author: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { len: [0, 120] },
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
    },
    {
      sequelize,
      modelName: 'MaintenanceRequest',
      tableName: 'maintenance_requests',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          name: 'maintenance_requests_equipment_id_idx',
          fields: ['equipment_id'],
        },
        {
          name: 'maintenance_requests_deleted_at_idx',
          fields: ['deleted_at'],
        },
        {
          name: 'maintenance_requests_status_created_at_idx',
          fields: ['status', 'created_at'],
          where: { deleted_at: null },
        },
        {
          name: 'maintenance_requests_title_trgm_idx',
          fields: ['title'],
          using: 'GIN',
          where: { deleted_at: null },
        },
      ],
    },
  );
}
