import { MAX_REQUEST_IMPORT_ITEMS } from '../../src/config/constants.js';
import { requestPayload } from '../helpers/fixtures.js';
import {
  api,
  createEquipment,
  createRequest,
  expectApiError,
  withApiKey,
} from '../helpers/http.js';
import { resetStore } from '../helpers/store.js';

describe('/api/requests', () => {
  beforeEach(async () => {
    await resetStore();
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
    await createRequest(equipment.id, { title: 'First open request' });
    const second = await createRequest(equipment.id, { title: 'Second open request' });
    await withApiKey(api().patch(`/api/requests/${second.id}/status`))
      .send({ status: 'in_progress' })
      .expect(200);

    const response = await api().get('/api/requests').query({ status: 'new' }).expect(200);

    expect(response.body.meta).toEqual({ total: 1, page: 1, limit: 10 });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ title: 'First open request', status: 'new' });
  });

  it('обновляет поля заявки без смены статуса', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);
    const response = await withApiKey(api().patch(`/api/requests/${requestItem.id}`))
      .send({ title: 'Updated request title', priority: 'high' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: requestItem.id,
      status: 'new',
      title: 'Updated request title',
      priority: 'high',
    });
    expect(response.body.data.updatedAt).not.toBe(requestItem.updatedAt);
  });

  it('переводит заявку по допустимому статусу', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);

    const inProgress = await withApiKey(api().patch(`/api/requests/${requestItem.id}/status`))
      .send({ status: 'in_progress' })
      .expect(200);
    expect(inProgress.body.data.status).toBe('in_progress');

    const done = await withApiKey(api().patch(`/api/requests/${requestItem.id}/status`))
      .send({ status: 'done' })
      .expect(200);
    expect(done.body.data.status).toBe('done');
  });

  it('запрещает недопустимый переход статуса', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);

    const response = await withApiKey(api().patch(`/api/requests/${requestItem.id}/status`)).send({
      status: 'done',
    });

    expectApiError(response, 409, 'CONFLICT');
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

  it('возвращает 404 для неизвестной заявки', async () => {
    const response = await api().get('/api/requests/missing-id');
    expectApiError(response, 404, 'NOT_FOUND');
  });

  describe('POST /api/requests/import', () => {
    it('создаёт все валидные заявки и возвращает отчёт', async () => {
      const equipment = await createEquipment();
      const items = [
        requestPayload(equipment.id, { title: 'First import request' }),
        requestPayload(equipment.id, { title: 'Second import request', priority: 'high' }),
      ];

      const response = await withApiKey(api().post('/api/requests/import'))
        .send({ items })
        .expect(201);

      expect(response.body.meta).toEqual({ total: 2, succeeded: 2, failed: 0 });
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results[0]).toMatchObject({
        index: 0,
        ok: true,
        data: { title: 'First import request', status: 'new', equipmentId: equipment.id },
      });
      expect(response.body.results[1]).toMatchObject({
        index: 1,
        ok: true,
        data: { title: 'Second import request', priority: 'high' },
      });

      const listed = await api().get('/api/requests').expect(200);
      expect(listed.body.meta.total).toBe(2);
    });

    it('принимает валидные записи и сообщает об ошибках остальных', async () => {
      const equipment = await createEquipment();
      const items = [
        requestPayload(equipment.id, { title: 'Valid import request' }),
        { ...requestPayload(equipment.id), title: 'abc' },
        requestPayload('missing-equipment', { title: 'Unknown equipment request' }),
      ];

      const response = await withApiKey(api().post('/api/requests/import'))
        .send({ items })
        .expect(207);

      expect(response.body.meta).toEqual({ total: 3, succeeded: 1, failed: 2 });
      expect(response.body.results[0]).toMatchObject({
        index: 0,
        ok: true,
        data: { title: 'Valid import request' },
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
      expect(listed.body.data[0]).toMatchObject({ title: 'Valid import request' });
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
