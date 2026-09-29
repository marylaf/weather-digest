'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { disableHistoryGuard, enableHistoryGuard } = require('../requestStatusHistory.cjs');

const FILE_AUTHOR = 'file-import';
const SITE_CODE_PREFIX = 'FILE-';
const DEFAULT_EQUIPMENT_FILE = './data/equipment.json';
const DEFAULT_REQUESTS_FILE = './data/requests.json';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EQUIPMENT_TYPES = new Set(['turbine', 'inverter', 'sensor', 'substation']);
const EQUIPMENT_STATUSES = new Set(['operational', 'maintenance', 'fault', 'decommissioned']);
const REQUEST_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const REQUEST_STATUSES = new Set(['new', 'in_progress', 'done', 'rejected']);

async function up(queryInterface) {
  const snapshot = readSnapshot();
  const importedAt = new Date().toISOString();

  if (snapshot.sites.length === 0 && snapshot.requests.length === 0) {
    return;
  }

  await queryInterface.bulkInsert(
    'sites',
    snapshot.sites.map((site) => ({
      ...site,
      created_at: importedAt,
      updated_at: importedAt,
    })),
  );
  await queryInterface.bulkInsert(
    'equipment',
    snapshot.equipment.map((item) => ({
      id: item.id,
      site_id: item.site_id,
      name: item.name,
      type: item.type,
      serial_number: item.serial_number,
      status: item.status,
      installation_date: item.installation_date,
      created_at: `${item.installation_date}T00:00:00.000Z`,
      updated_at: importedAt,
    })),
  );
  await queryInterface.bulkInsert(
    'equipment_passports',
    snapshot.equipment.map((item) => ({
      id: uuidFromName(`passport:${item.id}`),
      equipment_id: item.id,
      manufacturer: 'не указан',
      model: item.type,
      nominal_power: null,
      last_verification_date: null,
      created_at: `${item.installation_date}T00:00:00.000Z`,
      updated_at: importedAt,
    })),
  );
  await queryInterface.bulkInsert('maintenance_requests', snapshot.requests);
  await queryInterface.bulkInsert('request_status_history', snapshot.history);
}

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 */
async function down(queryInterface) {
  await disableHistoryGuard(queryInterface);
  await queryInterface.sequelize.query(
    `DELETE FROM request_status_history WHERE changed_by = :author`,
    { replacements: { author: FILE_AUTHOR } },
  );
  await enableHistoryGuard(queryInterface);
  await queryInterface.sequelize.query(`DELETE FROM maintenance_requests WHERE author = :author`, {
    replacements: { author: FILE_AUTHOR },
  });
  await queryInterface.sequelize.query(`
    DELETE FROM equipment_passports
    WHERE equipment_id IN (
      SELECT equipment.id
      FROM equipment
      JOIN sites ON sites.id = equipment.site_id
      WHERE sites.code LIKE '${SITE_CODE_PREFIX}%'
    );
  `);
  await queryInterface.sequelize.query(`
    DELETE FROM equipment
    WHERE site_id IN (SELECT id FROM sites WHERE code LIKE '${SITE_CODE_PREFIX}%');
  `);
  await queryInterface.sequelize.query(`
    DELETE FROM sites WHERE code LIKE '${SITE_CODE_PREFIX}%';
  `);
}

function readSnapshot() {
  const equipmentFile = resolveDataFile('EQUIPMENT_FILE', DEFAULT_EQUIPMENT_FILE);
  const requestsFile = resolveDataFile('REQUESTS_FILE', DEFAULT_REQUESTS_FILE);
  const equipmentExists = fs.existsSync(equipmentFile);
  const requestsExists = fs.existsSync(requestsFile);

  if (!equipmentExists && !requestsExists) {
    console.info(
      `File import skipped: neither ${equipmentFile} nor ${requestsFile} exists. ` +
        'Put both JSON files in place to import Case 2 data.',
    );
    return { sites: [], equipment: [], requests: [], history: [] };
  }

  if (!equipmentExists || !requestsExists) {
    const missing = equipmentExists ? requestsFile : equipmentFile;
    throw new Error(
      `Case 2 file storage was not found at ${missing}. Set EQUIPMENT_FILE and REQUESTS_FILE together, or omit both files.`,
    );
  }

  const equipmentItems = readJsonArray(equipmentFile).map((item, index) =>
    parseEquipment(item, index, equipmentFile),
  );
  const requestItems = readJsonArray(requestsFile).map((item, index) =>
    parseRequest(item, index, requestsFile),
  );

  const equipmentIds = new Set(equipmentItems.map((item) => item.id));
  const serialNumbers = new Set();

  for (const item of equipmentItems) {
    if (serialNumbers.has(item.serial_number)) {
      throw new Error(`Duplicate serialNumber in ${equipmentFile}: ${item.serial_number}`);
    }

    serialNumbers.add(item.serial_number);
  }

  for (const request of requestItems) {
    if (!equipmentIds.has(request.equipmentId)) {
      throw new Error(
        `Request ${request.id} in ${requestsFile} references missing equipment ${request.equipmentId}`,
      );
    }
  }

  const sitesByKey = new Map();

  for (const item of equipmentItems) {
    const key = `${item.latitude.toFixed(6)}:${item.longitude.toFixed(6)}`;

    if (!sitesByKey.has(key)) {
      sitesByKey.set(key, {
        id: uuidFromName(`site:${key}`),
        name: `Импортированная площадка ${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`,
        code: `${SITE_CODE_PREFIX}${item.latitude.toFixed(6)}_${item.longitude.toFixed(6)}`,
        region: 'не указан',
        latitude: item.latitude,
        longitude: item.longitude,
      });
    }
  }

  return {
    sites: [...sitesByKey.values()],
    equipment: equipmentItems.map((item) => {
      const key = `${item.latitude.toFixed(6)}:${item.longitude.toFixed(6)}`;
      const site = sitesByKey.get(key);

      if (!site) {
        throw new Error(`Site was not created for equipment ${item.id}`);
      }

      return {
        id: item.id,
        site_id: site.id,
        name: item.name,
        type: item.type,
        serial_number: item.serial_number,
        status: item.status,
        installation_date: item.installation_date,
      };
    }),
    requests: requestItems.map((item) => ({
      id: item.id,
      equipment_id: item.equipmentId,
      title: item.title,
      description: item.description,
      priority: item.priority,
      status: item.status,
      planned_at: item.plannedAt,
      author: FILE_AUTHOR,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })),
    history: requestItems.map((item) => ({
      id: uuidFromName(`history:${item.id}`),
      request_id: item.id,
      old_status: null,
      new_status: item.status,
      changed_by: FILE_AUTHOR,
      comment: 'Импорт из файлового хранилища',
      created_at: item.createdAt,
    })),
  };
}

function resolveDataFile(envName, fallback) {
  const configured = process.env[envName]?.trim();
  return path.resolve(process.cwd(), configured || fallback);
}

function readJsonArray(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON array`);
  }

  return parsed;
}

function parseEquipment(value, index, filePath) {
  if (!isRecord(value)) {
    throw new Error(`${filePath}[${index}] must be an object`);
  }

  requireUuid(value.id, `${filePath}[${index}].id`);
  requireText(value.name, `${filePath}[${index}].name`, 100);
  requireText(value.serialNumber, `${filePath}[${index}].serialNumber`, 128);

  if (!EQUIPMENT_TYPES.has(value.type)) {
    throw new Error(`${filePath}[${index}].type is not a supported equipment type`);
  }

  if (!EQUIPMENT_STATUSES.has(value.status)) {
    throw new Error(`${filePath}[${index}].status is not a supported equipment status`);
  }

  const installationDate = toDateOnly(value.installedAt);

  if (installationDate === null) {
    throw new Error(`${filePath}[${index}].installedAt must be an ISO date`);
  }

  if (!isRecord(value.location)) {
    throw new Error(`${filePath}[${index}].location must be an object`);
  }

  const latitude = value.location.lat;
  const longitude = value.location.lon;

  if (!isCoordinate(latitude, -90, 90) || !isCoordinate(longitude, -180, 180)) {
    throw new Error(`${filePath}[${index}].location is out of range`);
  }

  return {
    id: value.id,
    name: value.name.trim(),
    type: value.type,
    serial_number: value.serialNumber.trim(),
    status: value.status,
    installation_date: installationDate,
    latitude,
    longitude,
  };
}

function parseRequest(value, index, filePath) {
  if (!isRecord(value)) {
    throw new Error(`${filePath}[${index}] must be an object`);
  }

  requireUuid(value.id, `${filePath}[${index}].id`);
  requireUuid(value.equipmentId, `${filePath}[${index}].equipmentId`);
  requireText(value.title, `${filePath}[${index}].title`, 120);
  requireText(value.description, `${filePath}[${index}].description`, 2000);
  requireTimestamp(value.createdAt, `${filePath}[${index}].createdAt`);
  requireTimestamp(value.updatedAt, `${filePath}[${index}].updatedAt`);

  if (!REQUEST_PRIORITIES.has(value.priority)) {
    throw new Error(`${filePath}[${index}].priority is not supported`);
  }

  if (!REQUEST_STATUSES.has(value.status)) {
    throw new Error(`${filePath}[${index}].status is not supported`);
  }

  let plannedAt = null;

  if (value.plannedAt !== undefined) {
    requireTimestamp(value.plannedAt, `${filePath}[${index}].plannedAt`);
    plannedAt = value.plannedAt;
  }

  return {
    id: value.id,
    equipmentId: value.equipmentId,
    title: value.title.trim(),
    description: value.description.trim(),
    priority: value.priority,
    status: value.status,
    plannedAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function uuidFromName(name) {
  const hash = createHash('sha256').update(`weather-digest-file-import:${name}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requireUuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a UUID`);
  }
}

function requireText(value, label, maxLength) {
  if (typeof value !== 'string' || value.trim() === '' || value.trim().length > maxLength) {
    throw new Error(`${label} must be a non-empty string up to ${maxLength} characters`);
  }
}

function requireTimestamp(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
}

function toDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return null;
  }

  return value.slice(0, 10);
}

function isCoordinate(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

module.exports = { up, down };
