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
import { REQUEST_STATUSES, type RequestStatus } from '../../types/request.js';
import type { MaintenanceRequest } from './maintenanceRequest.js';

const APPEND_ONLY_MESSAGE =
  'request_status_history is append-only and cannot be updated or deleted';

/**
 * Журнал смены статуса. Таблица `request_status_history`.
 * В таблице нет `updated_at`. UPDATE и DELETE запрещены триггером в БД.
 */
export class RequestStatusHistory extends Model<
  InferAttributes<RequestStatusHistory>,
  InferCreationAttributes<RequestStatusHistory>
> {
  declare id: CreationOptional<string>;
  declare requestId: ForeignKey<string>;
  declare oldStatus: RequestStatus | null;
  declare newStatus: RequestStatus;
  declare changedBy: string;
  declare comment: string | null;
  declare createdAt: CreationOptional<Date>;

  declare MaintenanceRequest?: NonAttribute<MaintenanceRequest>;
}

export function initRequestStatusHistoryModel(sequelize: Sequelize): void {
  RequestStatusHistory.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: literal('gen_random_uuid()'),
      },
      requestId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'request_id',
        references: { model: 'maintenance_requests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      oldStatus: {
        type: DataTypes.ENUM(...REQUEST_STATUSES),
        allowNull: true,
        field: 'old_status',
      },
      newStatus: {
        type: DataTypes.ENUM(...REQUEST_STATUSES),
        allowNull: false,
        field: 'new_status',
      },
      changedBy: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: 'changed_by',
        validate: { len: [0, 120] },
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
    },
    {
      sequelize,
      modelName: 'RequestStatusHistory',
      tableName: 'request_status_history',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
      updatedAt: false,
      indexes: [
        {
          name: 'request_status_history_request_id_created_at_idx',
          fields: ['request_id', 'created_at'],
        },
      ],
      validate: {
        oldStatusDiffersFromNewStatus() {
          if (this.oldStatus === this.newStatus) {
            throw new Error('old_status must be distinct from new_status');
          }
        },
      },
      hooks: {
        beforeUpdate() {
          throw new Error(APPEND_ONLY_MESSAGE);
        },
        beforeDestroy() {
          throw new Error(APPEND_ONLY_MESSAGE);
        },
        beforeBulkUpdate() {
          throw new Error(APPEND_ONLY_MESSAGE);
        },
        beforeBulkDestroy() {
          throw new Error(APPEND_ONLY_MESSAGE);
        },
      },
    },
  );
}
