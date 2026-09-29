import { Equipment as EquipmentModel } from '../../src/db/models/equipment.js';
import { initModels } from '../../src/db/models/index.js';
import { MaintenanceRequest as MaintenanceRequestModel } from '../../src/db/models/maintenanceRequest.js';
import { RequestAssignee } from '../../src/db/models/requestAssignee.js';
import { RequestStatusHistory } from '../../src/db/models/requestStatusHistory.js';
import { Site } from '../../src/db/models/site.js';
import { Technician } from '../../src/db/models/technician.js';
import { getSequelize } from '../../src/db/database.js';
import { EQUIPMENT_LOAD_SQL } from '../../src/api/repositories/report.repository.js';
import { api, createEquipment, createRequest, expectApiError } from '../helpers/http.js';
import { resetStore } from '../helpers/store.js';

describe('reports', () => {
  beforeEach(async () => {
    await resetStore();
  });

  it('возвращает нули и null, если у площадки нет заявок', async () => {
    initModels(getSequelize());
    const site = await Site.create({
      name: 'Пустая площадка',
      code: 'empty-site',
      region: 'test',
      latitude: '10.000000',
      longitude: '20.000000',
    });

    const response = await api().get(`/api/sites/${site.id}/summary`).expect(200);

    expect(response.body.data).toEqual({
      siteId: site.id,
      requestsByStatus: { new: 0, in_progress: 0, done: 0, rejected: 0 },
      requestsByPriority: { low: 0, medium: 0, high: 0, critical: 0 },
      averageCloseTimeSeconds: null,
    });
  });

  it('считает заявки площадки по статусу и приоритету и среднее только по закрытым', async () => {
    const alpha = await createEquipment({
      name: 'Alpha turbine',
      location: { lat: 55.75, lon: 37.62 },
    });
    const beta = await createEquipment({
      name: 'Beta inverter',
      type: 'inverter',
      location: { lat: 55.75, lon: 37.62 },
    });
    const other = await createEquipment({
      name: 'Other site sensor',
      type: 'sensor',
      location: { lat: 59.93, lon: 30.31 },
    });

    const doneRequest = await createRequest(alpha.id, { priority: 'high', title: 'Close blades' });
    const openRequest = await createRequest(alpha.id, {
      priority: 'low',
      title: 'Open inspection',
    });
    const rejectedRequest = await createRequest(alpha.id, {
      priority: 'critical',
      title: 'Reject visit',
    });
    const foreignRequest = await createRequest(other.id, {
      priority: 'medium',
      title: 'Foreign request',
    });

    initModels(getSequelize());
    await stampRequest(doneRequest.id, {
      status: 'done',
      priority: 'high',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await stampRequest(openRequest.id, {
      status: 'new',
      priority: 'low',
      createdAt: '2026-02-01T00:00:00.000Z',
    });
    await stampRequest(rejectedRequest.id, {
      status: 'rejected',
      priority: 'critical',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await stampRequest(foreignRequest.id, {
      status: 'done',
      priority: 'medium',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const lead = await Technician.create({
      fullName: 'Иванов Алексей',
      specialization: 'Электрика',
      employeeNumber: 'EMP-LOAD-1',
    });
    const member = await Technician.create({
      fullName: 'Петров Борис',
      specialization: 'Механика',
      employeeNumber: 'EMP-LOAD-2',
    });
    await RequestAssignee.bulkCreate([
      { requestId: doneRequest.id, technicianId: lead.id, role: 'lead', hours: '2.00' },
      { requestId: doneRequest.id, technicianId: member.id, role: 'member', hours: '3.50' },
      { requestId: openRequest.id, technicianId: lead.id, role: 'lead', hours: '1.00' },
    ]);
    await RequestStatusHistory.bulkCreate([
      {
        requestId: doneRequest.id,
        oldStatus: 'new',
        newStatus: 'in_progress',
        changedBy: 'test',
        comment: null,
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
      },
      {
        requestId: doneRequest.id,
        oldStatus: 'in_progress',
        newStatus: 'done',
        changedBy: 'test',
        comment: null,
        createdAt: new Date('2026-01-01T02:00:00.000Z'),
      },
      {
        requestId: rejectedRequest.id,
        oldStatus: 'new',
        newStatus: 'rejected',
        changedBy: 'test',
        comment: null,
        createdAt: new Date('2026-01-02T01:00:00.000Z'),
      },
      {
        requestId: foreignRequest.id,
        oldStatus: 'in_progress',
        newStatus: 'done',
        changedBy: 'test',
        comment: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    ]);

    const siteId = await siteIdOf(alpha.id);
    const summary = await api().get(`/api/sites/${siteId}/summary`).expect(200);

    expect(summary.body.data).toEqual({
      siteId,
      requestsByStatus: { new: 1, in_progress: 0, done: 1, rejected: 1 },
      requestsByPriority: { low: 1, medium: 0, high: 1, critical: 1 },
      averageCloseTimeSeconds: 5400,
    });

    const load = await api().get('/api/reports/equipment-load').expect(200);
    const byName = Object.fromEntries(
      (load.body.data as { name: string }[]).map((row) => [row.name, row]),
    );

    expect(byName['Alpha turbine']).toEqual({
      equipmentId: alpha.id,
      name: 'Alpha turbine',
      requestCount: 3,
      closedRequestCount: 2,
      plannedLaborHours: '6.50',
      lastMaintenanceAt: '2026-01-01T02:00:00.000Z',
    });
    expect(byName['Beta inverter']).toEqual({
      equipmentId: beta.id,
      name: 'Beta inverter',
      requestCount: 0,
      closedRequestCount: 0,
      plannedLaborHours: '0.00',
      lastMaintenanceAt: null,
    });
    expect(byName['Other site sensor']).toMatchObject({
      equipmentId: other.id,
      requestCount: 1,
      closedRequestCount: 1,
      plannedLaborHours: '0.00',
    });
  });

  it('фильтрует период по created_at и отсекает группы через minRequests', async () => {
    const alpha = await createEquipment({
      name: 'Alpha turbine',
      location: { lat: 55.75, lon: 37.62 },
    });
    const beta = await createEquipment({
      name: 'Beta inverter',
      type: 'inverter',
      location: { lat: 55.75, lon: 37.62 },
    });
    const january = await createRequest(alpha.id, { title: 'January visit' });
    const february = await createRequest(alpha.id, { title: 'February visit' });
    initModels(getSequelize());
    await stampRequest(january.id, {
      status: 'done',
      priority: 'medium',
      createdAt: '2026-01-15T08:00:00.000Z',
    });
    await stampRequest(february.id, {
      status: 'new',
      priority: 'low',
      createdAt: '2026-02-02T08:00:00.000Z',
    });
    await RequestStatusHistory.create({
      requestId: january.id,
      oldStatus: 'in_progress',
      newStatus: 'done',
      changedBy: 'test',
      comment: null,
      createdAt: new Date('2026-01-15T12:00:00.000Z'),
    });

    const filtered = await api()
      .get('/api/reports/equipment-load')
      .query({ createdFrom: '2026-02-01', createdTo: '2026-02-28', minRequests: '1' })
      .expect(200);

    expect(filtered.body.data).toEqual([
      {
        equipmentId: alpha.id,
        name: 'Alpha turbine',
        requestCount: 1,
        closedRequestCount: 0,
        plannedLaborHours: '0.00',
        lastMaintenanceAt: null,
      },
    ]);

    const alias = await api()
      .get('/api/reports/equipment-load')
      .query({ from: '2026-02-01', to: '2026-02-28', minRequests: '1' })
      .expect(200);
    expect(alias.body.data).toEqual(filtered.body.data);

    const withIdle = await api()
      .get('/api/reports/equipment-load')
      .query({ minRequests: '0' })
      .expect(200);
    expect(withIdle.body.data.map((row: { equipmentId: string }) => row.equipmentId)).toEqual(
      expect.arrayContaining([alpha.id, beta.id]),
    );
  });

  it('отвечает 404 для неизвестной площадки и 400 для плохих query', async () => {
    const missing = await api().get('/api/sites/00000000-0000-4000-8000-000000000099/summary');
    expectApiError(missing, 404, 'NOT_FOUND');

    const badDate = await api()
      .get('/api/reports/equipment-load')
      .query({ createdFrom: 'tomorrow' });
    expectApiError(badDate, 400, 'VALIDATION_ERROR');

    const negative = await api().get('/api/reports/equipment-load').query({ minRequests: '-1' });
    expectApiError(negative, 400, 'VALIDATION_ERROR');

    const injected = await api()
      .get('/api/reports/equipment-load')
      .query({ minRequests: '1 OR 1=1' });
    expectApiError(injected, 400, 'VALIDATION_ERROR');

    const inverted = await api()
      .get('/api/reports/equipment-load')
      .query({ createdFrom: '2026-05-02', createdTo: '2026-05-01' });
    expectApiError(inverted, 400, 'VALIDATION_ERROR');

    const conflict = await api().get('/api/reports/equipment-load').query({
      createdFrom: '2026-01-01',
      dateFrom: '2026-02-01',
    });
    expectApiError(conflict, 400, 'VALIDATION_ERROR');
  });

  it('держит агрегирующий SQL без SELECT * и с HAVING', () => {
    expect(EQUIPMENT_LOAD_SQL).toMatch(/JOIN/i);
    expect(EQUIPMENT_LOAD_SQL).toMatch(/GROUP BY/i);
    expect(EQUIPMENT_LOAD_SQL).toMatch(/HAVING/i);
    expect(EQUIPMENT_LOAD_SQL).toMatch(/COUNT\(DISTINCT/i);
    expect(EQUIPMENT_LOAD_SQL).toMatch(/SUM\(/i);
    expect(EQUIPMENT_LOAD_SQL).toMatch(/MAX\(/i);
    expect(EQUIPMENT_LOAD_SQL).not.toMatch(/SELECT\s+\*/i);
    expect(EQUIPMENT_LOAD_SQL).toContain('$1');
    expect(EQUIPMENT_LOAD_SQL).toContain('$3');
  });
});

async function siteIdOf(equipmentId: string): Promise<string> {
  initModels(getSequelize());
  const row = await EquipmentModel.findByPk(equipmentId, { attributes: ['siteId'] });

  if (row === null) {
    throw new Error(`Equipment ${equipmentId} was not stored`);
  }

  return row.siteId;
}

async function stampRequest(
  id: string,
  values: {
    status: 'new' | 'in_progress' | 'done' | 'rejected';
    priority: 'low' | 'medium' | 'high' | 'critical';
    createdAt: string;
  },
): Promise<void> {
  initModels(getSequelize());
  const [updated] = await MaintenanceRequestModel.update(
    {
      status: values.status,
      priority: values.priority,
      createdAt: new Date(values.createdAt),
    },
    { where: { id }, silent: true },
  );

  if (updated !== 1) {
    throw new Error(`Request ${id} was not updated`);
  }
}
