import { jest } from '@jest/globals';
import { MAX_REQUEST_IMPORT_ITEMS } from '../../src/config/constants.js';
import { getSequelize } from '../../src/db/database.js';
import {
  initModels,
  RequestAssignee,
  RequestStatusHistory,
  Technician,
} from '../../src/db/models/index.js';
import { requestPayload } from '../helpers/fixtures.js';
import {
  api,
  createEquipment,
  createRequest,
  expectApiError,
  withApiKey,
} from '../helpers/http.js';
import { resetStore } from '../helpers/store.js';

async function createTechnician(employeeNumber: string): Promise<Technician> {
  initModels(getSequelize());
  return Technician.create({
    fullName: `Техник ${employeeNumber}`,
    specialization: 'Электрика',
    employeeNumber,
  });
}

async function assignBrigade(
  requestId: string,
  technicians: { id: string; role: 'lead' | 'member'; hours?: string | number }[],
) {
  return withApiKey(api().post(`/api/requests/${requestId}/assignees`))
    .send({
      assignees: technicians.map((technician) => ({
        technicianId: technician.id,
        role: technician.role,
        ...(technician.hours === undefined ? {} : { hours: technician.hours }),
      })),
    })
    .expect(200);
}

describe('/api/requests', () => {
  beforeEach(async () => {
    await resetStore();
  });

  it('ищет заявку по фрагменту заголовка', async () => {
    const equipment = await createEquipment();
    await createRequest(equipment.id, { title: 'Замена подшипника' });
    await createRequest(equipment.id, { title: 'Осмотр площадки' });

    const found = await api().get('/api/requests').query({ q: 'ПОДШИП' }).expect(200);
    expect(found.body.data).toEqual([expect.objectContaining({ title: 'Замена подшипника' })]);
    expect(found.body.meta.total).toBe(1);
  });

  it('создаёт заявку для существующего оборудования', async () => {
    const equipment = await createEquipment();
    const payload = requestPayload(equipment.id);
    const created = await withApiKey(api().post('/api/requests')).send(payload).expect(201);

    expect(created.headers.location).toBe(`/api/requests/${created.body.data.id}`);
    expect(created.body.data).toMatchObject({
      ...payload,
      id: expect.any(String),
      status: 'new',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      assignedTechnicians: [],
    });

    const fetched = await api().get(`/api/requests/${created.body.data.id}`).expect(200);
    expect(fetched.body.data).toEqual(created.body.data);
  });

  it('не создаёт заявку для неизвестного оборудования', async () => {
    const response = await withApiKey(api().post('/api/requests')).send(
      requestPayload('missing-equipment'),
    );
    expectApiError(response, 404, 'NOT_FOUND');
  });

  it('отдаёт список заявок с фильтром по статусу', async () => {
    const equipment = await createEquipment();
    await createRequest(equipment.id, { title: 'Первая открытая заявка' });
    const second = await createRequest(equipment.id, { title: 'Вторая открытая заявка' });
    await withApiKey(api().patch(`/api/requests/${second.id}/status`))
      .send({ status: 'rejected' })
      .expect(200);

    const response = await api().get('/api/requests').query({ status: 'new' }).expect(200);

    expect(response.body.meta).toEqual({ total: 1, page: 1, limit: 10 });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ title: 'Первая открытая заявка', status: 'new' });
  });

  it('обновляет поля заявки без смены статуса', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);
    const response = await withApiKey(api().patch(`/api/requests/${requestItem.id}`))
      .send({ title: 'Обновлённый заголовок заявки', priority: 'high' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: requestItem.id,
      status: 'new',
      title: 'Обновлённый заголовок заявки',
      priority: 'high',
    });
    expect(response.body.data.updatedAt).not.toBe(requestItem.updatedAt);
  });

  it('переводит заявку по допустимому статусу', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);
    const lead = await createTechnician('lead-transition');
    await assignBrigade(requestItem.id, [{ id: lead.id, role: 'lead' }]);

    const inProgress = await withApiKey(api().patch(`/api/requests/${requestItem.id}/status`))
      .send({ status: 'in_progress', comment: 'Бригада выехала' })
      .expect(200);
    expect(inProgress.body.data.status).toBe('in_progress');

    const done = await withApiKey(api().patch(`/api/requests/${requestItem.id}/status`))
      .send({ status: 'done' })
      .expect(200);
    expect(done.body.data.status).toBe('done');

    const history = await api().get(`/api/requests/${requestItem.id}/history`).expect(200);
    expect(history.body.data).toEqual([
      expect.objectContaining({
        requestId: requestItem.id,
        oldStatus: 'new',
        newStatus: 'in_progress',
        changedBy: 'api',
        comment: 'Бригада выехала',
      }),
      expect.objectContaining({
        requestId: requestItem.id,
        oldStatus: 'in_progress',
        newStatus: 'done',
        changedBy: 'api',
        comment: null,
      }),
    ]);
  });

  it('не переводит заявку в in_progress без назначенных специалистов', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);

    const response = await withApiKey(api().patch(`/api/requests/${requestItem.id}/status`)).send({
      status: 'in_progress',
    });

    expectApiError(response, 409, 'CONFLICT');
    const fetched = await api().get(`/api/requests/${requestItem.id}`).expect(200);
    expect(fetched.body.data.status).toBe('new');
    const history = await api().get(`/api/requests/${requestItem.id}/history`).expect(200);
    expect(history.body.data).toEqual([]);
  });

  it('запрещает недопустимый переход статуса', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);

    const response = await withApiKey(api().patch(`/api/requests/${requestItem.id}/status`)).send({
      status: 'done',
    });

    expectApiError(response, 409, 'CONFLICT');
  });

  it('добавляет назначенных техников с ролью и не меняет прежние поля', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id, { title: 'Назначение техников' });
    initModels(getSequelize());
    const technician = await Technician.create({
      fullName: 'Иванов Алексей',
      specialization: 'Электрика',
      employeeNumber: `EMP-${requestItem.id.slice(0, 8)}`,
    });
    await RequestAssignee.create({
      requestId: requestItem.id,
      technicianId: technician.id,
      role: 'lead',
      hours: '1.50',
    });

    const response = await api().get(`/api/requests/${requestItem.id}`).expect(200);

    expect(response.body.data).toMatchObject({
      id: requestItem.id,
      equipmentId: equipment.id,
      title: 'Назначение техников',
      status: 'new',
      priority: requestItem.priority,
    });
    expect(response.body.data.assignedTechnicians).toEqual([
      {
        id: technician.id,
        fullName: 'Иванов Алексей',
        specialization: 'Электрика',
        employeeNumber: technician.employeeNumber,
        role: 'lead',
        hours: '1.50',
      },
    ]);

    const listed = await api()
      .get('/api/requests')
      .query({ equipmentId: equipment.id })
      .expect(200);
    expect(listed.body.data[0]).not.toHaveProperty('assignedTechnicians');
  });

  it('удаляет заявку', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);

    await withApiKey(api().delete(`/api/requests/${requestItem.id}`)).expect(204);
    const missing = await api().get(`/api/requests/${requestItem.id}`);
    expectApiError(missing, 404, 'NOT_FOUND');
  });

  it('отклоняет создание с невалидным телом', async () => {
    const equipment = await createEquipment();
    const response = await withApiKey(api().post('/api/requests')).send({
      ...requestPayload(equipment.id),
      title: 'abc',
    });

    expectApiError(response, 422, 'VALIDATION_ERROR');
  });

  describe('бригада и история статусов', () => {
    it('заменяет бригаду и оставляет ровно одного lead', async () => {
      const equipment = await createEquipment();
      const requestItem = await createRequest(equipment.id, { title: 'Заявка на бригаду' });
      const lead = await createTechnician('lead-brigade');
      const member = await createTechnician('member-brigade');

      const response = await assignBrigade(requestItem.id, [
        { id: lead.id, role: 'lead', hours: 1.5 },
        { id: member.id, role: 'member', hours: '2.00' },
      ]);

      expect(response.body.data.assignedTechnicians).toEqual([
        expect.objectContaining({ id: lead.id, role: 'lead', hours: '1.50' }),
        expect.objectContaining({ id: member.id, role: 'member', hours: '2.00' }),
      ]);

      const replacement = await createTechnician('lead-replacement');
      const replaced = await assignBrigade(requestItem.id, [{ id: replacement.id, role: 'lead' }]);
      expect(replaced.body.data.assignedTechnicians).toEqual([
        expect.objectContaining({ id: replacement.id, role: 'lead' }),
      ]);
    });

    it('отклоняет бригаду без единственного lead и с повтором специалиста', async () => {
      const equipment = await createEquipment();
      const requestItem = await createRequest(equipment.id);
      const lead = await createTechnician('lead-invalid');
      const member = await createTechnician('member-invalid');

      const twoLeads = await withApiKey(
        api().post(`/api/requests/${requestItem.id}/assignees`),
      ).send({
        assignees: [
          { technicianId: lead.id, role: 'lead' },
          { technicianId: member.id, role: 'lead' },
        ],
      });
      expectApiError(twoLeads, 422, 'VALIDATION_ERROR');

      const duplicate = await withApiKey(
        api().post(`/api/requests/${requestItem.id}/assignees`),
      ).send({
        assignees: [
          { technicianId: lead.id, role: 'lead' },
          { technicianId: lead.id, role: 'member' },
        ],
      });
      expectApiError(duplicate, 409, 'CONFLICT');

      const fetched = await api().get(`/api/requests/${requestItem.id}`).expect(200);
      expect(fetched.body.data.assignedTechnicians).toEqual([]);
    });

    it('возвращает 404, если заявка или специалист не найдены', async () => {
      const equipment = await createEquipment();
      const requestItem = await createRequest(equipment.id);
      const lead = await createTechnician('lead-missing');

      const missingRequest = await withApiKey(
        api().post('/api/requests/00000000-0000-4000-8000-000000000001/assignees'),
      ).send({
        assignees: [{ technicianId: lead.id, role: 'lead' }],
      });
      expectApiError(missingRequest, 404, 'NOT_FOUND');

      const missingTechnician = await withApiKey(
        api().post(`/api/requests/${requestItem.id}/assignees`),
      ).send({
        assignees: [{ technicianId: '00000000-0000-4000-8000-000000000002', role: 'lead' }],
      });
      expectApiError(missingTechnician, 404, 'NOT_FOUND');
    });

    it('снимает специалиста, в том числе lead, и не требует нового lead', async () => {
      const equipment = await createEquipment();
      const requestItem = await createRequest(equipment.id);
      const lead = await createTechnician('lead-remove');
      const member = await createTechnician('member-remove');
      await assignBrigade(requestItem.id, [
        { id: lead.id, role: 'lead' },
        { id: member.id, role: 'member' },
      ]);

      await withApiKey(api().delete(`/api/requests/${requestItem.id}/assignees/${lead.id}`)).expect(
        204,
      );

      const fetched = await api().get(`/api/requests/${requestItem.id}`).expect(200);
      expect(fetched.body.data.assignedTechnicians).toEqual([
        expect.objectContaining({ id: member.id, role: 'member' }),
      ]);

      const missingAssignment = await withApiKey(
        api().delete(`/api/requests/${requestItem.id}/assignees/${lead.id}`),
      );
      expectApiError(missingAssignment, 404, 'NOT_FOUND');
    });

    it('оставляет журнал статусов после скрытия заявки', async () => {
      const equipment = await createEquipment();
      const requestItem = await createRequest(equipment.id);
      await withApiKey(api().patch(`/api/requests/${requestItem.id}/status`))
        .send({ status: 'rejected', comment: 'не выезжаем' })
        .expect(200);
      await withApiKey(api().delete(`/api/requests/${requestItem.id}`)).expect(204);

      initModels(getSequelize());
      const history = await RequestStatusHistory.findAll({
        where: { requestId: requestItem.id },
      });
      expect(history).toEqual([
        expect.objectContaining({
          requestId: requestItem.id,
          newStatus: 'rejected',
        }),
      ]);

      const missing = await api().get(`/api/requests/${requestItem.id}`);
      expectApiError(missing, 404, 'NOT_FOUND');
    });

    it('откатывает статус, если запись истории падает', async () => {
      const equipment = await createEquipment();
      const requestItem = await createRequest(equipment.id);
      const createHistory = jest
        .spyOn(RequestStatusHistory, 'create')
        .mockRejectedValueOnce(new Error('history insert failed'));

      try {
        const response = await withApiKey(
          api().patch(`/api/requests/${requestItem.id}/status`),
        ).send({ status: 'rejected' });
        expect(response.status).toBe(500);
      } finally {
        createHistory.mockRestore();
      }

      const fetched = await api().get(`/api/requests/${requestItem.id}`).expect(200);
      expect(fetched.body.data.status).toBe('new');
      const history = await api().get(`/api/requests/${requestItem.id}/history`).expect(200);
      expect(history.body.data).toEqual([]);
    });

    it('откатывает замену бригады, если вставка назначений падает', async () => {
      const equipment = await createEquipment();
      const requestItem = await createRequest(equipment.id);
      const lead = await createTechnician('lead-rollback');
      const replacement = await createTechnician('lead-rollback-next');
      await assignBrigade(requestItem.id, [{ id: lead.id, role: 'lead', hours: '3.00' }]);

      const bulkCreate = jest
        .spyOn(RequestAssignee, 'bulkCreate')
        .mockRejectedValueOnce(new Error('assignee insert failed'));

      try {
        const response = await withApiKey(
          api().post(`/api/requests/${requestItem.id}/assignees`),
        ).send({
          assignees: [{ technicianId: replacement.id, role: 'lead', hours: '1.00' }],
        });
        expect(response.status).toBe(500);
      } finally {
        bulkCreate.mockRestore();
      }

      const fetched = await api().get(`/api/requests/${requestItem.id}`).expect(200);
      expect(fetched.body.data.assignedTechnicians).toEqual([
        expect.objectContaining({ id: lead.id, role: 'lead', hours: '3.00' }),
      ]);
    });
  });

  it('возвращает 404 для неизвестной заявки', async () => {
    const response = await api().get('/api/requests/missing-id');
    expectApiError(response, 404, 'NOT_FOUND');
  });

  describe('POST /api/requests/import', () => {
    it('создаёт все валидные заявки и возвращает отчёт', async () => {
      const equipment = await createEquipment();
      const items = [
        requestPayload(equipment.id, { title: 'Первая импортированная заявка' }),
        requestPayload(equipment.id, { title: 'Вторая импортированная заявка', priority: 'high' }),
      ];

      const response = await withApiKey(api().post('/api/requests/import'))
        .send({ items })
        .expect(201);

      expect(response.body.meta).toEqual({ total: 2, succeeded: 2, failed: 0 });
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results[0]).toMatchObject({
        index: 0,
        ok: true,
        data: { title: 'Первая импортированная заявка', status: 'new', equipmentId: equipment.id },
      });
      expect(response.body.results[1]).toMatchObject({
        index: 1,
        ok: true,
        data: { title: 'Вторая импортированная заявка', priority: 'high' },
      });

      const listed = await api().get('/api/requests').expect(200);
      expect(listed.body.meta.total).toBe(2);
    });

    it('принимает валидные записи и сообщает об ошибках остальных', async () => {
      const equipment = await createEquipment();
      const items = [
        requestPayload(equipment.id, { title: 'Корректная импортированная заявка' }),
        { ...requestPayload(equipment.id), title: 'abc' },
        requestPayload('missing-equipment', { title: 'Заявка на неизвестное оборудование' }),
      ];

      const response = await withApiKey(api().post('/api/requests/import'))
        .send({ items })
        .expect(207);

      expect(response.body.meta).toEqual({ total: 3, succeeded: 1, failed: 2 });
      expect(response.body.results[0]).toMatchObject({
        index: 0,
        ok: true,
        data: { title: 'Корректная импортированная заявка' },
      });
      expect(response.body.results[1]).toMatchObject({
        index: 1,
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: expect.any(String) },
      });
      expect(response.body.results[1].error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'title' })]),
      );
      expect(response.body.results[2]).toMatchObject({
        index: 2,
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Equipment not found' },
      });

      const listed = await api().get('/api/requests').expect(200);
      expect(listed.body.meta.total).toBe(1);
      expect(listed.body.data[0]).toMatchObject({ title: 'Корректная импортированная заявка' });
    });

    it('возвращает отчёт, если все записи отклонены', async () => {
      const response = await withApiKey(api().post('/api/requests/import'))
        .send({
          items: [{ title: 'abc' }, requestPayload('missing-equipment')],
        })
        .expect(207);

      expect(response.body.meta).toEqual({ total: 2, succeeded: 0, failed: 2 });
      expect(response.body.results.every((item: { ok: boolean }) => item.ok === false)).toBe(true);

      const listed = await api().get('/api/requests').expect(200);
      expect(listed.body.meta.total).toBe(0);
    });

    it('отклоняет пустой список и слишком большой пакет', async () => {
      const empty = await withApiKey(api().post('/api/requests/import')).send({ items: [] });
      expectApiError(empty, 422, 'VALIDATION_ERROR');

      const tooMany = await withApiKey(api().post('/api/requests/import')).send({
        items: Array.from({ length: MAX_REQUEST_IMPORT_ITEMS + 1 }, () => ({})),
      });
      expectApiError(tooMany, 422, 'VALIDATION_ERROR');
    });
  });
});
