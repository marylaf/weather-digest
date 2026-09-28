import { Sequelize, type FindOptions, type Model, type ModelStatic } from 'sequelize';
import { Equipment } from '../../src/db/models/equipment.js';
import { EquipmentPassport } from '../../src/db/models/equipmentPassport.js';
import { initModels, MaintenanceRequest } from '../../src/db/models/index.js';
import { RequestAssignee } from '../../src/db/models/requestAssignee.js';
import { RequestStatusHistory } from '../../src/db/models/requestStatusHistory.js';
import { Site } from '../../src/db/models/site.js';
import { Technician } from '../../src/db/models/technician.js';
import {
  equipmentListOptions,
  equipmentWithPassportOptions,
  maintenanceRequestWithStatusHistoryOptions,
  maintenanceRequestWithTechniciansOptions,
} from '../../src/db/queries/reads.js';

const sequelize = new Sequelize('weather_digest', 'user', 'password', {
  host: '127.0.0.1',
  dialect: 'postgres',
  logging: false,
});

initModels(sequelize);

describe('sequelize models', () => {
  it('регистрирует связи без алиасов и с внешними ключами схемы', () => {
    expect(describeAssociations(Site)).toEqual({
      Equipment: { type: 'HasMany', target: 'Equipment', foreignKey: 'siteId' },
    });
    expect(describeAssociations(Equipment)).toEqual({
      Site: { type: 'BelongsTo', target: 'Site', foreignKey: 'siteId' },
      EquipmentPassport: {
        type: 'HasOne',
        target: 'EquipmentPassport',
        foreignKey: 'equipmentId',
      },
      MaintenanceRequests: {
        type: 'HasMany',
        target: 'MaintenanceRequest',
        foreignKey: 'equipmentId',
      },
    });
    expect(describeAssociations(EquipmentPassport)).toEqual({
      Equipment: { type: 'BelongsTo', target: 'Equipment', foreignKey: 'equipmentId' },
    });
    expect(describeAssociations(MaintenanceRequest)).toEqual({
      Equipment: { type: 'BelongsTo', target: 'Equipment', foreignKey: 'equipmentId' },
      RequestStatusHistories: {
        type: 'HasMany',
        target: 'RequestStatusHistory',
        foreignKey: 'requestId',
      },
      Technicians: {
        type: 'BelongsToMany',
        target: 'Technician',
        foreignKey: 'requestId',
        otherKey: 'technicianId',
      },
      RequestAssignees: { type: 'HasMany', target: 'RequestAssignee', foreignKey: 'requestId' },
    });
    expect(describeAssociations(RequestStatusHistory)).toEqual({
      MaintenanceRequest: {
        type: 'BelongsTo',
        target: 'MaintenanceRequest',
        foreignKey: 'requestId',
      },
    });
    expect(describeAssociations(Technician)).toEqual({
      MaintenanceRequests: {
        type: 'BelongsToMany',
        target: 'MaintenanceRequest',
        foreignKey: 'technicianId',
        otherKey: 'requestId',
      },
      RequestAssignees: { type: 'HasMany', target: 'RequestAssignee', foreignKey: 'technicianId' },
    });
    expect(describeAssociations(RequestAssignee)).toEqual({
      MaintenanceRequest: {
        type: 'BelongsTo',
        target: 'MaintenanceRequest',
        foreignKey: 'requestId',
      },
      Technician: { type: 'BelongsTo', target: 'Technician', foreignKey: 'technicianId' },
    });

    const technicians = MaintenanceRequest.associations.Technicians;
    expect(associationKeys(technicians)).toMatchObject({
      sourceKey: 'id',
      targetKey: 'id',
    });
  });

  it('совпадает с ограничениями migrations', () => {
    expect(Site.getAttributes().code).toMatchObject({
      allowNull: false,
      unique: 'sites_code_unique',
      field: 'code',
    });
    expect(Site.getAttributes().latitude.allowNull).toBe(false);
    expect(Site.getAttributes().createdAt?.field).toBe('created_at');

    expect(Equipment.getAttributes().siteId).toMatchObject({
      allowNull: false,
      field: 'site_id',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
    expect(enumValues(Equipment, 'type')).toEqual(['turbine', 'inverter', 'sensor', 'substation']);
    expect(enumValues(Equipment, 'status')).toEqual([
      'operational',
      'maintenance',
      'fault',
      'decommissioned',
    ]);
    expect(Equipment.getAttributes().serialNumber).toMatchObject({
      allowNull: false,
      unique: 'equipment_serial_number_unique',
      field: 'serial_number',
    });
    expect(Equipment.getAttributes().installationDate?.field).toBe('installation_date');

    expect(EquipmentPassport.getAttributes().equipmentId).toMatchObject({
      allowNull: false,
      unique: 'equipment_passports_equipment_id_unique',
      field: 'equipment_id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    expect(EquipmentPassport.getAttributes().nominalPower).toMatchObject({
      allowNull: true,
      field: 'nominal_power',
    });
    expect(EquipmentPassport.getAttributes().lastVerificationDate).toMatchObject({
      allowNull: true,
      field: 'last_verification_date',
    });

    expect(Technician.getAttributes().employeeNumber).toMatchObject({
      allowNull: false,
      unique: 'technicians_employee_number_unique',
      field: 'employee_number',
    });

    expect(enumValues(MaintenanceRequest, 'priority')).toEqual([
      'low',
      'medium',
      'high',
      'critical',
    ]);
    expect(enumValues(MaintenanceRequest, 'status')).toEqual([
      'new',
      'in_progress',
      'done',
      'rejected',
    ]);
    expect(MaintenanceRequest.getAttributes().plannedAt).toMatchObject({
      allowNull: true,
      field: 'planned_at',
    });
    expect(MaintenanceRequest.getAttributes().equipmentId).toMatchObject({
      allowNull: false,
      onDelete: 'RESTRICT',
    });

    expect('updatedAt' in RequestStatusHistory.getAttributes()).toBe(false);
    expect(RequestStatusHistory.getAttributes().oldStatus).toMatchObject({
      allowNull: true,
      field: 'old_status',
    });
    expect(RequestStatusHistory.getAttributes().newStatus).toMatchObject({
      allowNull: false,
      field: 'new_status',
    });
    expect(RequestStatusHistory.getAttributes().comment?.allowNull).toBe(true);
    expect(RequestStatusHistory.options.updatedAt).toBe(false);

    expect(RequestAssignee.getAttributes().requestId?.primaryKey).toBe(true);
    expect(RequestAssignee.getAttributes().technicianId?.primaryKey).toBe(true);
    expect(RequestAssignee.primaryKeyAttribute).toBe('requestId');
    expect(enumValues(RequestAssignee, 'role')).toEqual(['lead', 'member']);
    expect(RequestAssignee.getAttributes().hours).toMatchObject({ allowNull: false });
    expect(RequestAssignee.getAttributes().requestId).toMatchObject({
      allowNull: false,
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
    expect(RequestAssignee.getAttributes().technicianId).toMatchObject({
      allowNull: false,
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  });

  it('собирает include без SELECT * и без N+1 на списке оборудования', () => {
    const equipmentSql = compileSelect(Equipment, equipmentWithPassportOptions());
    expect(equipmentSql).not.toMatch(/SELECT\s+\*/i);
    expect(equipmentSql).toContain('"serial_number"');
    expect(equipmentSql).toContain('"installation_date"');
    expect(equipmentSql).toContain('"equipment_passports"');
    expect(equipmentSql).toContain('"manufacturer"');
    expect(equipmentSql).not.toContain('"equipment_passports"."created_at"');

    const listSql = compileSelect(Equipment, equipmentListOptions());
    expect(listSql).not.toMatch(/SELECT\s+\*/i);
    expect(listSql).toContain('JOIN');
    expect(listSql).toContain('"sites"');
    expect(listSql).toContain('"equipment_passports"');
    expect(listSql).toContain('"site_id"');
    expect(listSql.match(/SELECT/g)).toHaveLength(1);

    const techniciansSql = compileSelect(
      MaintenanceRequest,
      maintenanceRequestWithTechniciansOptions(),
    );
    expect(techniciansSql).not.toMatch(/SELECT\s+\*/i);
    expect(techniciansSql).toContain('"equipment_id"');
    expect(techniciansSql).toContain('AS "Technicians.RequestAssignee.role"');
    expect(techniciansSql).toContain('AS "Technicians.RequestAssignee.hours"');
    expect(techniciansSql).not.toContain('RequestAssignee.createdAt');
    expect(techniciansSql).toContain('"Technicians"."full_name"');

    const historyOptions = maintenanceRequestWithStatusHistoryOptions();
    const historyInclude = historyOptions.include;
    expect(Array.isArray(historyInclude)).toBe(true);
    if (!Array.isArray(historyInclude)) {
      return;
    }
    expect(historyInclude[0]).toMatchObject({
      separate: true,
      attributes: ['id', 'oldStatus', 'newStatus', 'changedBy', 'comment', 'createdAt'],
    });

    const historySql = compileSelect(MaintenanceRequest, {
      attributes: historyOptions.attributes,
    });
    expect(historySql).not.toMatch(/SELECT\s+\*/i);
    expect(historySql).toContain('"author"');
    expect(historySql).toContain('"planned_at"');
  });
});

function describeAssociations(model: ModelStatic<Model>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(model.associations).map(([name, association]) => [
      name,
      {
        type: association.associationType,
        target: association.target.name,
        foreignKey: association.foreignKey,
        ...('otherKey' in association ? { otherKey: association.otherKey } : {}),
      },
    ]),
  );
}

function enumValues(model: ModelStatic<Model>, attribute: string): string[] {
  const type = model.getAttributes()[attribute]?.type;
  if (
    typeof type !== 'object' ||
    type === null ||
    !('values' in type) ||
    !Array.isArray(type.values)
  ) {
    throw new Error(`Attribute ${model.name}.${attribute} is not an enum`);
  }

  return type.values;
}

function associationKeys(association: object | undefined): {
  sourceKey?: unknown;
  targetKey?: unknown;
} {
  if (!association || !('sourceKey' in association)) {
    return {};
  }

  return {
    sourceKey: association.sourceKey,
    targetKey: 'targetKey' in association ? association.targetKey : undefined,
  };
}

function mapAttributeNamesToColumns(model: ModelStatic<Model>, options: FindOptions): void {
  if (!Array.isArray(options.attributes)) {
    return;
  }

  options.attributes = options.attributes.map((attribute) => {
    if (typeof attribute !== 'string') {
      return attribute;
    }

    const column = model.getAttributes()[attribute];
    if (column?.field && column.field !== attribute) {
      return [column.field, attribute];
    }

    return attribute;
  });
}

function compileSelect(model: ModelStatic<Model>, options: FindOptions): string {
  const queryOptions: FindOptions = {
    ...options,
    include: options.include ? [...(options.include as [])] : undefined,
    type: 'SELECT',
  };
  const compiler = model as ModelStatic<Model> & {
    _validateIncludedElements(findOptions: FindOptions): void;
  };
  if (queryOptions.include) {
    compiler._validateIncludedElements(queryOptions);
  }
  mapAttributeNamesToColumns(model, queryOptions);
  const queryGenerator = model.sequelize?.getQueryInterface().queryGenerator as
    | {
        selectQuery(
          tableName: string,
          findOptions: FindOptions,
          sourceModel: ModelStatic<Model>,
        ): string;
      }
    | undefined;
  if (!queryGenerator) {
    throw new Error(`Model ${model.name} is not bound to Sequelize`);
  }

  return queryGenerator.selectQuery(model.tableName, queryOptions, model);
}
