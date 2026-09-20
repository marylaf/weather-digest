import { requestPayload } from '../helpers/fixtures.js';
import { api, createEquipment, createRequest, expectApiError } from '../helpers/http.js';
import { resetStore } from '../helpers/store.js';

describe('/api/requests', () => {
  beforeEach(async () => {
    await resetStore();
  });

  it('создаёт заявку для существующего оборудования', async () => {
    const equipment = await createEquipment();
    const payload = requestPayload(equipment.id);
    const created = await api().post('/api/requests').send(payload).expect(201);

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
    const response = await api().post('/api/requests').send(requestPayload('missing-equipment'));
    expectApiError(response, 404, 'NOT_FOUND');
  });

  it('отдаёт список заявок с фильтром по статусу', async () => {
    const equipment = await createEquipment();
    await createRequest(equipment.id, { title: 'First open request' });
    const second = await createRequest(equipment.id, { title: 'Second open request' });
    await api()
      .patch(`/api/requests/${second.id}/status`)
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
    const response = await api()
      .patch(`/api/requests/${requestItem.id}`)
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

    const inProgress = await api()
      .patch(`/api/requests/${requestItem.id}/status`)
      .send({ status: 'in_progress' })
      .expect(200);
    expect(inProgress.body.data.status).toBe('in_progress');

    const done = await api()
      .patch(`/api/requests/${requestItem.id}/status`)
      .send({ status: 'done' })
      .expect(200);
    expect(done.body.data.status).toBe('done');
  });

  it('запрещает недопустимый переход статуса', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);

    const response = await api()
      .patch(`/api/requests/${requestItem.id}/status`)
      .send({ status: 'done' });

    expectApiError(response, 409, 'CONFLICT');
  });

  it('удаляет заявку', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);

    await api().delete(`/api/requests/${requestItem.id}`).expect(204);
    const missing = await api().get(`/api/requests/${requestItem.id}`);
    expectApiError(missing, 404, 'NOT_FOUND');
  });

  it('отклоняет создание с невалидным телом', async () => {
    const equipment = await createEquipment();
    const response = await api()
      .post('/api/requests')
      .send({ ...requestPayload(equipment.id), title: 'abc' });

    expectApiError(response, 400, 'VALIDATION_ERROR');
  });

  it('возвращает 404 для неизвестной заявки', async () => {
    const response = await api().get('/api/requests/missing-id');
    expectApiError(response, 404, 'NOT_FOUND');
  });
});
