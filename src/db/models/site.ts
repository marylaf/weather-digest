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
import type { Equipment } from './equipment.js';

/**
 * Площадка. Таблица `sites`.
 * Координаты — NUMERIC, Sequelize отдаёт их строкой.
 */
export class Site extends Model<InferAttributes<Site>, InferCreationAttributes<Site>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare code: string;
  declare region: string;
  declare latitude: string;
  declare longitude: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  /** Аксессор hasMany без alias: pluralize("Equipment") === "Equipment". */
  declare Equipment?: NonAttribute<Equipment[]>;
}

export function initSiteModel(sequelize: Sequelize): void {
  Site.init(
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
        validate: { len: [0, 200] },
      },
      code: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: 'sites_code_unique',
        validate: { len: [0, 64] },
      },
      region: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { len: [0, 120] },
      },
      latitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: false,
        validate: { min: -90, max: 90 },
      },
      longitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: false,
        validate: { min: -180, max: 180 },
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
      modelName: 'Site',
      tableName: 'sites',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
    },
  );
}
