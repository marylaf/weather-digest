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
import type { RequestSparePart } from './requestSparePart.js';

/**
 * Запчасть на складе. Таблица `spare_parts`.
 * `sku` уникален среди строк с `deleted_at IS NULL`.
 * `stockQuantity` — NUMERIC, Sequelize отдаёт его строкой.
 */
export class SparePart extends Model<
  InferAttributes<SparePart>,
  InferCreationAttributes<SparePart>
> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare sku: string;
  declare stockQuantity: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare MaintenanceRequests?: NonAttribute<MaintenanceRequest[]>;
  declare RequestSpareParts?: NonAttribute<RequestSparePart[]>;
}

export function initSparePartModel(sequelize: Sequelize): void {
  SparePart.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: literal('gen_random_uuid()'),
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      stockQuantity: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: '0.00',
        field: 'stock_quantity',
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
      modelName: 'SparePart',
      tableName: 'spare_parts',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          name: 'spare_parts_sku_active_idx',
          unique: true,
          fields: ['sku'],
          where: { deleted_at: null },
        },
      ],
    },
  );
}
