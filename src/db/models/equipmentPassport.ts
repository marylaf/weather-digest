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
import type { Equipment } from './equipment.js';

/**
 * Паспорт оборудования, 1:1 с `equipment`. Таблица `equipment_passports`.
 * `nominalPower` — NUMERIC, Sequelize отдаёт его строкой.
 */
export class EquipmentPassport extends Model<
  InferAttributes<EquipmentPassport>,
  InferCreationAttributes<EquipmentPassport>
> {
  declare id: CreationOptional<string>;
  declare equipmentId: ForeignKey<string>;
  declare manufacturer: string;
  declare model: string;
  declare nominalPower: string | null;
  declare lastVerificationDate: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare Equipment?: NonAttribute<Equipment>;
}

export function initEquipmentPassportModel(sequelize: Sequelize): void {
  EquipmentPassport.init(
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
        unique: 'equipment_passports_equipment_id_unique',
        field: 'equipment_id',
        references: { model: 'equipment', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      manufacturer: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: { len: [0, 200] },
      },
      model: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: { len: [0, 200] },
      },
      nominalPower: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'nominal_power',
        validate: { min: 0 },
      },
      lastVerificationDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'last_verification_date',
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
      modelName: 'EquipmentPassport',
      tableName: 'equipment_passports',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
    },
  );
}
