import {
  DataTypes,
  Model,
  literal,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';
import type { MaintenanceRequest } from './maintenanceRequest.js';
import type { RequestAssignee } from './requestAssignee.js';

/**
 * Техник. Таблица `technicians`.
 */
export class Technician extends Model<
  InferAttributes<Technician>,
  InferCreationAttributes<Technician>
> {
  declare id: CreationOptional<string>;
  declare fullName: string;
  declare specialization: string;
  declare employeeNumber: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare MaintenanceRequests?: NonAttribute<MaintenanceRequest[]>;
  declare RequestAssignees?: NonAttribute<RequestAssignee[]>;
}

export function initTechnicianModel(sequelize: Sequelize): void {
  Technician.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: literal('gen_random_uuid()'),
      },
      fullName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'full_name',
        validate: { len: [0, 200] },
      },
      specialization: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { len: [0, 120] },
      },
      employeeNumber: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: 'technicians_employee_number_unique',
        field: 'employee_number',
        validate: { len: [0, 64] },
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
      modelName: 'Technician',
      tableName: 'technicians',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
    },
  );
}
