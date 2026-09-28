import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';
import type { MaintenanceRequest } from './maintenanceRequest.js';
import type { Technician } from './technician.js';

export const ASSIGNEE_ROLES = ['lead', 'member'] as const;
export type AssigneeRole = (typeof ASSIGNEE_ROLES)[number];

/**
 * Назначение техника на заявку. Таблица `request_assignees`.
 * Составной первичный ключ `(request_id, technician_id)`.
 * `hours` — NUMERIC, Sequelize отдаёт его строкой.
 */
export class RequestAssignee extends Model<
  InferAttributes<RequestAssignee>,
  InferCreationAttributes<RequestAssignee>
> {
  declare requestId: ForeignKey<string>;
  declare technicianId: ForeignKey<string>;
  declare role: AssigneeRole;
  declare hours: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare MaintenanceRequest?: NonAttribute<MaintenanceRequest>;
  declare Technician?: NonAttribute<Technician>;
}

export function initRequestAssigneeModel(sequelize: Sequelize): void {
  RequestAssignee.init(
    {
      requestId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: 'request_id',
        references: { model: 'maintenance_requests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      technicianId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: 'technician_id',
        references: { model: 'technicians', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      role: {
        type: DataTypes.ENUM(...ASSIGNEE_ROLES),
        allowNull: false,
      },
      hours: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        validate: { min: 0 },
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
    },
    {
      sequelize,
      modelName: 'RequestAssignee',
      tableName: 'request_assignees',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
      indexes: [
        {
          name: 'request_assignees_one_lead_per_request',
          unique: true,
          fields: ['request_id'],
          where: { role: 'lead' },
        },
        {
          name: 'request_assignees_technician_id_idx',
          fields: ['technician_id'],
        },
      ],
    },
  );
}
