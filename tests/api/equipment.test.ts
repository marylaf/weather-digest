import { jest } from '@jest/globals';
import { equipmentPayload, forecastApiResponse } from '../helpers/fixtures.js';
import {
  api,
  createEquipment,
  createRequest,
  expectApiError,
  withApiKey,
} from '../helpers/http.js';
import { resetStore } from '../helpers/store.js';

describe('/api/equipment', () => {
  beforeEach(async () => {
    await resetStore();
    jest.restoreAllMocks();
  });

  it('создаёт оборудование и возвращает его по id', async () => {
    const payload = equipmentPayload({ name: 'Moscow turbine' });
    const created = await withApiKey(api().post('/api/equipment')).send(payload).expect(201);

    expect(created.headers.location).toBe(`/api/equipment/${created.body.data.id}`);
    expect(created.body.data).toMatchObject({
      ...payload,
      id: expect.any(String),
    });

    const fetched = await api().get(`/api/equipment/${created.body.data.id}`).expect(200);
    expect(fetched.body.data).toEqual(created.body.data);
  });

  it('отдаёт список с пагинацией и фильтром по статусу', async () => {
    await createEquipment({ name: 'Alpha turbine', status: 'operational' });
    await createEquipment({ name: 'Beta inverter', type: 'inverter', status: 'fault' });

    const response = await api()
      .get('/api/equipment')
      .query({ status: 'operational', page: '1', limit: '10' })
      .expect(200);

    expect(response.body.meta).toEqual({ total: 1, page: 1, limit: 10 });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ name: 'Alpha turbine', status: 'operational' });
  });

  it('обновляет оборудование', async () => {
    const equipment = await createEquipment();
    const response = await withApiKey(api().patch(`/api/equipment/${equipment.id}`))
      .send({ status: 'maintenance', name: 'Updated turbine' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: equipment.id,
      status: 'maintenance',
      name: 'Updated turbine',
      serialNumber: equipment.serialNumber,
    });
  });

  it('удаляет оборудование без открытых заявок', async () => {
    const equipment = await createEquipment();

    await withApiKey(api().delete(`/api/equipment/${equipment.id}`)).expect(204);
    const missing = await api().get(`/api/equipment/${equipment.id}`);
    expectApiError(missing, 404, 'NOT_FOUND');
  });

  it('не даёт удалить оборудование с открытой заявкой', async () => {
    const equipment = await createEquipment();
    await createRequest(equipment.id);

    const response = await withApiKey(api().delete(`/api/equipment/${equipment.id}`));
    expectApiError(response, 409, 'CONFLICT');
  });

  it('отклоняет создание с невалидным телом', async () => {
    const response = await withApiKey(api().post('/api/equipment')).send({
      ...equipmentPayload(),
      name: 'ab',
    });

    expectApiError(response, 400, 'VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'name',
          message: expect.any(String),
        }),
      ]),
    );
  });

  it('не создаёт оборудование с занятым serialNumber', async () => {
    const payload = equipmentPayload({ serialNumber: 'WT-DUP-001' });
    await withApiKey(api().post('/api/equipment')).send(payload).expect(201);

    const response = await withApiKey(api().post('/api/equipment')).send(
      equipmentPayload({ serialNumber: 'WT-DUP-001' }),
    );
    expectApiError(response, 409, 'CONFLICT');
  });

  it('возвращает 404 для неизвестного id', async () => {
    const response = await api().get('/api/equipment/missing-id');
    expectApiError(response, 404, 'NOT_FOUND');
  });

  it('возвращает заявки по оборудованию', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id, { title: 'Check inverter fans' });

    const response = await api().get(`/api/equipment/${equipment.id}/requests`).expect(200);
    expect(response.body.data).toEqual([expect.objectContaining({ id: requestItem.id })]);
  });

  it('возвращает прогноз для оборудования', async () => {
    const equipment = await createEquipment();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(forecastApiResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await api().get(`/api/equipment/${equipment.id}/weather`).expect(200);

    expect(response.body.data).toEqual({
      equipmentId: equipment.id,
      outdoorWorkSuitable: true,
      weather: {
        coordinates: { latitude: equipment.location.lat, longitude: equipment.location.lon },
        units: 'metric',
        forecast: [
          {
            date: '2026-09-20',
            minTemperature: 7.7,
            maxTemperature: 16.2,
            precipitation: 0,
            windSpeed: 4.2,
          },
          {
            date: '2026-09-21',
            minTemperature: 9.1,
            maxTemperature: 19.2,
            precipitation: 0,
            windSpeed: 5.1,
          },
          {
            date: '2026-09-22',
            minTemperature: 10.9,
            maxTemperature: 17.3,
            precipitation: 0.5,
            windSpeed: 6,
          },
        ],
      },
    });
  });

  it('возвращает 503, если погодный сервис недоступен', async () => {
    const equipment = await createEquipment();
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    const response = await api().get(`/api/equipment/${equipment.id}/weather`);
    expectApiError(response, 503, 'EXTERNAL_SERVICE_UNAVAILABLE');
  });
});
