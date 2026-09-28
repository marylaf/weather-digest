'use strict';

const { disableHistoryGuard, enableHistoryGuard } = require('../requestStatusHistory.cjs');

const SITE_NORTH = 'a1111111-1111-4111-8111-111111111111';
const SITE_COAST = 'a2222222-2222-4222-8222-222222222222';

/** @param {string} prefix @param {number} n */
function id(prefix, n) {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** @param {number} requestNumber @param {number} step */
function historyId(requestNumber, step) {
  return `f0000000-0000-4000-8000-${String(requestNumber * 10 + step).padStart(12, '0')}`;
}

/** @param {string} iso @param {number} days */
function addDays(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

const technicians = [
  {
    id: id('d0000000', 1),
    full_name: 'Иванов Алексей Сергеевич',
    specialization: 'Электрика',
    employee_number: 'EMP-1001',
  },
  {
    id: id('d0000000', 2),
    full_name: 'Петрова Мария Игоревна',
    specialization: 'Механика ветроустановок',
    employee_number: 'EMP-1002',
  },
  {
    id: id('d0000000', 3),
    full_name: 'Сидоров Илья Павлович',
    specialization: 'Диагностика',
    employee_number: 'EMP-1003',
  },
  {
    id: id('d0000000', 4),
    full_name: 'Кузнецова Ольга Викторовна',
    specialization: 'Высоковольтное оборудование',
    employee_number: 'EMP-1004',
  },
  {
    id: id('d0000000', 5),
    full_name: 'Орлов Никита Андреевич',
    specialization: 'КИПиА',
    employee_number: 'EMP-1005',
  },
];

const equipment = [
  {
    n: 1,
    site_id: SITE_NORTH,
    name: 'Турбина Север-1',
    type: 'turbine',
    serial_number: 'SN-DEMO-001',
    status: 'operational',
    installation_date: '2023-04-12',
    manufacturer: 'Vestas',
    model: 'V150-4.2',
    nominal_power: 4200,
    last_verification_date: '2026-03-01',
  },
  {
    n: 2,
    site_id: SITE_NORTH,
    name: 'Инвертор Север-2',
    type: 'inverter',
    serial_number: 'SN-DEMO-002',
    status: 'operational',
    installation_date: '2023-08-01',
    manufacturer: 'Huawei',
    model: 'SUN2000',
    nominal_power: 500,
    last_verification_date: '2026-01-15',
  },
  {
    n: 3,
    site_id: SITE_NORTH,
    name: 'Датчик вибрации Север-3',
    type: 'sensor',
    serial_number: 'SN-DEMO-003',
    status: 'maintenance',
    installation_date: '2024-02-14',
    manufacturer: 'IFM',
    model: 'VVB001',
    nominal_power: 0.05,
    last_verification_date: null,
  },
  {
    n: 4,
    site_id: SITE_NORTH,
    name: 'Подстанция Север-4',
    type: 'substation',
    serial_number: 'SN-DEMO-004',
    status: 'fault',
    installation_date: '2022-11-03',
    manufacturer: 'ABB',
    model: 'UniGear',
    nominal_power: 10000,
    last_verification_date: '2025-11-20',
  },
  {
    n: 5,
    site_id: SITE_COAST,
    name: 'Турбина Берег-1',
    type: 'turbine',
    serial_number: 'SN-DEMO-005',
    status: 'operational',
    installation_date: '2024-05-20',
    manufacturer: 'Siemens Gamesa',
    model: 'SG 5.8',
    nominal_power: 5800,
    last_verification_date: '2026-06-01',
  },
  {
    n: 6,
    site_id: SITE_COAST,
    name: 'Инвертор Берег-2',
    type: 'inverter',
    serial_number: 'SN-DEMO-006',
    status: 'decommissioned',
    installation_date: '2021-09-09',
    manufacturer: 'SMA',
    model: 'Sunny Central',
    nominal_power: 2500,
    last_verification_date: '2024-09-01',
  },
];

const requests = [
  spec(
    1,
    1,
    'low',
    'new',
    '2026-01-12T08:00:00.000Z',
    null,
    'Осмотр лопастей северного ряда',
    'Плановый визуальный осмотр перед зимним сезоном.',
  ),
  spec(
    2,
    1,
    'medium',
    'new',
    '2026-02-03T09:00:00.000Z',
    '2026-10-05T08:00:00.000Z',
    'Проверка смазки редуктора',
    'Контроль уровня и состояния масла.',
  ),
  spec(
    3,
    1,
    'high',
    'in_progress',
    '2026-03-01T07:30:00.000Z',
    '2026-09-15T08:00:00.000Z',
    'Замена датчика оборотов',
    'Штатный датчик отдаёт нестабильный сигнал.',
  ),
  spec(
    4,
    2,
    'critical',
    'in_progress',
    '2026-03-18T06:00:00.000Z',
    '2026-09-20T08:00:00.000Z',
    'Аварийный останов инвертора',
    'Инвертор ушёл в защиту по перегреву.',
  ),
  spec(
    5,
    2,
    'low',
    'done',
    '2026-04-01T08:00:00.000Z',
    '2026-04-10T08:00:00.000Z',
    'Протяжка силовых клемм',
    'Плановая протяжка после первого сезона.',
  ),
  spec(
    6,
    2,
    'medium',
    'done',
    '2026-04-20T08:00:00.000Z',
    '2026-05-12T08:00:00.000Z',
    'Калибровка измерительных цепей',
    'Сверка показаний с эталонным прибором.',
  ),
  spec(
    7,
    3,
    'high',
    'done',
    '2026-05-11T08:00:00.000Z',
    '2026-06-02T08:00:00.000Z',
    'Замена вибродатчика',
    'Датчик не вышел на связь после грозы.',
  ),
  spec(
    8,
    3,
    'critical',
    'rejected',
    '2026-05-20T08:00:00.000Z',
    null,
    'Срочная замена контроллера',
    'Заявка отклонена: контроллер на гарантии поставщика.',
    'new',
  ),
  spec(
    9,
    3,
    'low',
    'in_progress',
    '2026-06-08T08:00:00.000Z',
    '2026-09-25T08:00:00.000Z',
    'Поверка канала вибрации',
    'Сверка нуля и амплитуды на стенде.',
  ),
  spec(
    10,
    4,
    'medium',
    'new',
    '2026-06-15T08:00:00.000Z',
    '2026-11-01T08:00:00.000Z',
    'Осмотр ячейки ввода',
    'Плановый осмотр без отключения потребителей.',
  ),
  spec(
    11,
    4,
    'high',
    'done',
    '2026-06-20T08:00:00.000Z',
    '2026-07-01T08:00:00.000Z',
    'Ремонт привода разъединителя',
    'Привод не доходил до конечного положения.',
  ),
  spec(
    12,
    4,
    'critical',
    'rejected',
    '2026-07-01T08:00:00.000Z',
    '2026-07-15T08:00:00.000Z',
    'Замена силового трансформатора',
    'После осмотра признано достаточным сушить масло.',
    'in_progress',
  ),
  spec(
    13,
    5,
    'low',
    'new',
    '2026-07-10T08:00:00.000Z',
    '2026-12-01T08:00:00.000Z',
    'Осмотр лопастей береговой турбины',
    'Сезонный осмотр после солевого налёта.',
  ),
  spec(
    14,
    5,
    'medium',
    'in_progress',
    '2026-07-22T08:00:00.000Z',
    '2026-09-28T08:00:00.000Z',
    'Регулировка тормоза',
    'Тормоз срабатывает с задержкой.',
  ),
  spec(
    15,
    5,
    'high',
    'done',
    '2026-08-01T08:00:00.000Z',
    '2026-08-15T08:00:00.000Z',
    'Замена подшипника генератора',
    'Повышенный нагрев и шум на номинале.',
  ),
  spec(
    16,
    5,
    'critical',
    'rejected',
    '2026-08-10T08:00:00.000Z',
    '2026-08-20T08:00:00.000Z',
    'Останов станции из-за шторма',
    'Отклонено: уставки защиты уже покрывают режим.',
    'new',
  ),
  spec(
    17,
    6,
    'low',
    'done',
    '2026-08-18T08:00:00.000Z',
    '2026-08-28T08:00:00.000Z',
    'Демонтаж кабельной перемычки',
    'Подготовка выведенного инвертора к списанию.',
  ),
  spec(
    18,
    6,
    'medium',
    'new',
    '2026-09-01T08:00:00.000Z',
    '2026-10-20T08:00:00.000Z',
    'Инвентаризация ЗИП инвертора',
    'Сверка остатков перед закрытием карточки.',
  ),
  spec(
    19,
    6,
    'high',
    'in_progress',
    '2026-09-05T08:00:00.000Z',
    '2026-09-30T08:00:00.000Z',
    'Утилизация силового модуля',
    'Модуль снят, ожидается акт списания.',
  ),
  spec(
    20,
    1,
    'critical',
    'new',
    '2026-09-20T08:00:00.000Z',
    '2026-10-12T08:00:00.000Z',
    'Трещина на комле лопасти',
    'Обнаружена при обходе, нужен дефектоскопист.',
  ),
];

const assignees = [
  assign(1, 1, 'lead', 0),
  assign(3, 1, 'lead', 4),
  assign(3, 2, 'member', 2),
  assign(4, 4, 'lead', 6),
  assign(4, 1, 'member', 1.5),
  assign(5, 2, 'lead', 3),
  assign(5, 3, 'member', 3),
  assign(6, 1, 'lead', 8),
  assign(7, 3, 'lead', 5),
  assign(7, 5, 'member', 2),
  assign(9, 5, 'lead', 1),
  assign(9, 3, 'member', 1),
  assign(11, 4, 'lead', 7.5),
  assign(11, 2, 'member', 4),
  assign(12, 4, 'lead', 2),
  assign(14, 2, 'lead', 3),
  assign(14, 5, 'member', 2.5),
  assign(15, 1, 'lead', 6),
  assign(15, 4, 'member', 2),
  assign(15, 3, 'member', 1),
  assign(16, 5, 'member', 1),
  assign(17, 5, 'lead', 2),
  assign(19, 3, 'lead', 4),
  assign(19, 2, 'member', 4),
  assign(20, 4, 'lead', 0),
];

function spec(
  n,
  equipmentNumber,
  priority,
  status,
  createdAt,
  plannedAt,
  title,
  description,
  rejectedFrom,
) {
  return {
    n,
    equipmentNumber,
    priority,
    status,
    createdAt,
    plannedAt,
    title,
    description,
    rejectedFrom: rejectedFrom ?? null,
  };
}

function assign(requestNumber, technicianNumber, role, hours) {
  return { requestNumber, technicianNumber, role, hours };
}

function authorForEquipment(equipmentNumber) {
  return equipmentNumber <= 4 ? 'Диспетчерская Москва' : 'Диспетчерская Сочи';
}

function statusChain(request) {
  if (request.status === 'new') {
    return [{ oldStatus: null, newStatus: 'new', comment: 'Заявка создана' }];
  }

  if (request.status === 'in_progress') {
    return [
      { oldStatus: null, newStatus: 'new', comment: 'Заявка создана' },
      { oldStatus: 'new', newStatus: 'in_progress', comment: 'Взято в работу' },
    ];
  }

  if (request.status === 'done') {
    return [
      { oldStatus: null, newStatus: 'new', comment: 'Заявка создана' },
      { oldStatus: 'new', newStatus: 'in_progress', comment: 'Взято в работу' },
      { oldStatus: 'in_progress', newStatus: 'done', comment: 'Работы завершены' },
    ];
  }

  if (request.rejectedFrom === 'new') {
    return [
      { oldStatus: null, newStatus: 'new', comment: 'Заявка создана' },
      { oldStatus: 'new', newStatus: 'rejected', comment: 'Отклонено до начала работ' },
    ];
  }

  return [
    { oldStatus: null, newStatus: 'new', comment: 'Заявка создана' },
    { oldStatus: 'new', newStatus: 'in_progress', comment: 'Взято в работу' },
    { oldStatus: 'in_progress', newStatus: 'rejected', comment: 'Отклонено после осмотра' },
  ];
}

function leadName(requestNumber) {
  const lead = assignees.find(
    (item) => item.requestNumber === requestNumber && item.role === 'lead',
  );
  if (!lead) {
    return null;
  }

  return technicians[lead.technicianNumber - 1]?.full_name ?? null;
}

function buildRequestRows() {
  return requests.map((request) => {
    const chain = statusChain(request);
    const updatedAt = addDays(request.createdAt, chain.length - 1);

    return {
      id: id('e0000000', request.n),
      equipment_id: id('b0000000', request.equipmentNumber),
      title: request.title,
      description: request.description,
      priority: request.priority,
      status: request.status,
      planned_at: request.plannedAt,
      author: authorForEquipment(request.equipmentNumber),
      created_at: request.createdAt,
      updated_at: updatedAt,
    };
  });
}

function buildHistoryRows() {
  return requests.flatMap((request) => {
    const author = authorForEquipment(request.equipmentNumber);
    const lead = leadName(request.n);

    return statusChain(request).map((step, index) => ({
      id: historyId(request.n, index + 1),
      request_id: id('e0000000', request.n),
      old_status: step.oldStatus,
      new_status: step.newStatus,
      changed_by: index === 0 ? author : (lead ?? author),
      comment: step.comment,
      created_at: addDays(request.createdAt, index),
    }));
  });
}

function buildAssigneeRows() {
  return assignees.map((item) => {
    const request = requests.find((candidate) => candidate.n === item.requestNumber);

    return {
      request_id: id('e0000000', item.requestNumber),
      technician_id: id('d0000000', item.technicianNumber),
      role: item.role,
      hours: item.hours,
      created_at: request?.createdAt ?? new Date(0).toISOString(),
      updated_at: request?.createdAt ?? new Date(0).toISOString(),
    };
  });
}

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {string} table
 * @param {string} column
 * @param {readonly string[]} ids
 */
async function deleteByIds(queryInterface, table, column, ids) {
  if (ids.length === 0) {
    return;
  }

  await queryInterface.sequelize.query(`DELETE FROM ${table} WHERE ${column} IN (:ids)`, {
    replacements: { ids },
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = '2026-09-01T00:00:00.000Z';

    await queryInterface.bulkInsert('sites', [
      {
        id: SITE_NORTH,
        name: 'Северная ВЭС',
        code: 'MSK-NORTH',
        region: 'Москва',
        latitude: 55.751244,
        longitude: 37.618423,
        created_at: now,
        updated_at: now,
      },
      {
        id: SITE_COAST,
        name: 'Прибрежная площадка',
        code: 'SOCHI-COAST',
        region: 'Краснодарский край',
        latitude: 43.585472,
        longitude: 39.723098,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert(
      'equipment',
      equipment.map((item) => ({
        id: id('b0000000', item.n),
        site_id: item.site_id,
        name: item.name,
        type: item.type,
        serial_number: item.serial_number,
        status: item.status,
        installation_date: item.installation_date,
        created_at: `${item.installation_date}T00:00:00.000Z`,
        updated_at: now,
      })),
    );

    await queryInterface.bulkInsert(
      'equipment_passports',
      equipment.map((item) => ({
        id: id('c0000000', item.n),
        equipment_id: id('b0000000', item.n),
        manufacturer: item.manufacturer,
        model: item.model,
        nominal_power: item.nominal_power,
        last_verification_date: item.last_verification_date,
        created_at: `${item.installation_date}T00:00:00.000Z`,
        updated_at: now,
      })),
    );

    await queryInterface.bulkInsert(
      'technicians',
      technicians.map((item) => ({
        ...item,
        created_at: now,
        updated_at: now,
      })),
    );

    await queryInterface.bulkInsert('maintenance_requests', buildRequestRows());
    await queryInterface.bulkInsert('request_status_history', buildHistoryRows());
    await queryInterface.bulkInsert('request_assignees', buildAssigneeRows());
  },

  async down(queryInterface) {
    const requestIds = requests.map((request) => id('e0000000', request.n));
    const equipmentIds = equipment.map((item) => id('b0000000', item.n));
    const technicianIds = technicians.map((item) => item.id);

    await deleteByIds(queryInterface, 'request_assignees', 'request_id', requestIds);
    await disableHistoryGuard(queryInterface);
    await deleteByIds(queryInterface, 'request_status_history', 'request_id', requestIds);
    await enableHistoryGuard(queryInterface);
    await deleteByIds(queryInterface, 'maintenance_requests', 'id', requestIds);
    await deleteByIds(queryInterface, 'equipment_passports', 'equipment_id', equipmentIds);
    await deleteByIds(queryInterface, 'equipment', 'id', equipmentIds);
    await deleteByIds(queryInterface, 'technicians', 'id', technicianIds);
    await deleteByIds(queryInterface, 'sites', 'id', [SITE_NORTH, SITE_COAST]);
  },
};
