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
import type { SparePart } from './sparePart.js';

/**
 * Списание запчасти на заявку. Таблица `request_spare_parts`.
 * Составной первичный ключ `(request_id, spare_part_id)`.
 */
export class RequestSparePart extends Model<
  InferAttributes<RequestSparePart>,
  InferCreationAttributes<RequestSparePart>
> {
  declare requestId: ForeignKey<string>;
  declare sparePartId: ForeignKey<string>;
  declare quantity: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare MaintenanceRequest?: NonAttribute<MaintenanceRequest>;
  declare SparePart?: NonAttribute<SparePart>;
}

export function initRequestSparePartModel(sequelize: Sequelize): void {
  RequestSparePart.init(
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
      sparePartId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: 'spare_part_id',
        references: { model: 'spare_parts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      quantity: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0.01 },
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
      modelName: 'RequestSparePart',
      tableName: 'request_spare_parts',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
      indexes: [
        {
          name: 'request_spare_parts_spare_part_id_idx',
          fields: ['spare_part_id'],
        },
      ],
    },
  );
}
