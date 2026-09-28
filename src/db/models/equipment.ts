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
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES } from '../../types/equipment.js';
import type { EquipmentPassport } from './equipmentPassport.js';
import type { MaintenanceRequest } from './maintenanceRequest.js';
import type { Site } from './site.js';

/**
 * Единица оборудования. Таблица `equipment`.
 */
export class Equipment extends Model<
  InferAttributes<Equipment>,
  InferCreationAttributes<Equipment>
> {
  declare id: CreationOptional<string>;
  declare siteId: ForeignKey<string>;
  declare name: string;
  declare type: (typeof EQUIPMENT_TYPES)[number];
  declare serialNumber: string;
  declare status: (typeof EQUIPMENT_STATUSES)[number];
  declare installationDate: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare Site?: NonAttribute<Site>;
  declare EquipmentPassport?: NonAttribute<EquipmentPassport>;
  declare MaintenanceRequests?: NonAttribute<MaintenanceRequest[]>;
}

export function initEquipmentModel(sequelize: Sequelize): void {
  Equipment.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: literal('gen_random_uuid()'),
      },
      siteId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'site_id',
        references: { model: 'sites', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { len: [0, 100] },
      },
      type: {
        type: DataTypes.ENUM(...EQUIPMENT_TYPES),
        allowNull: false,
      },
      serialNumber: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: 'equipment_serial_number_unique',
        field: 'serial_number',
        validate: { len: [0, 128] },
      },
      status: {
        type: DataTypes.ENUM(...EQUIPMENT_STATUSES),
        allowNull: false,
      },
      installationDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'installation_date',
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
      modelName: 'Equipment',
      tableName: 'equipment',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
      indexes: [
        {
          name: 'equipment_site_id_idx',
          fields: ['site_id'],
        },
      ],
    },
  );
}
