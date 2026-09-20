import { equipmentPayload } from '../helpers/fixtures.js';
import { api, createEquipment, expectApiError, TEST_API_KEY, withApiKey } from '../helpers/http.js';
import { resetStore } from '../helpers/store.js';

describe('аутентификация изменяющих операций', () => {
  beforeEach(async () => {
    await resetStore();
  });

  it('отдаёт GET без ключа', async () => {
    await api().get('/api/health').expect(200);
    await api().get('/api/equipment').expect(200);
  });

  it('отклоняет POST без ключа', async () => {
    const response = await api().post('/api/equipment').send(equipmentPayload());
    expectApiError(response, 401, 'UNAUTHORIZED');
    expect(response.headers['www-authenticate']).toMatch(/ApiKey/i);
  });

  it('отклоняет PATCH и DELETE без ключа', async () => {
    const equipment = await createEquipment();

    const patched = await api().patch(`/api/equipment/${equipment.id}`).send({ name: 'No auth' });
    expectApiError(patched, 401, 'UNAUTHORIZED');

    const deleted = await api().delete(`/api/equipment/${equipment.id}`);
    expectApiError(deleted, 401, 'UNAUTHORIZED');
  });

  it('отклоняет неверный ключ', async () => {
    const response = await withApiKey(api().post('/api/equipment'), 'wrong-key').send(
      equipmentPayload(),
    );
    expectApiError(response, 401, 'UNAUTHORIZED');
  });

  it('принимает X-API-Key', async () => {
    await withApiKey(api().post('/api/equipment'))
      .send(equipmentPayload({ name: 'Keyed turbine' }))
      .expect(201);
  });

  it('принимает Authorization: Bearer', async () => {
    await api()
      .post('/api/equipment')
      .set('Authorization', `Bearer ${TEST_API_KEY}`)
      .send(equipmentPayload({ name: 'Bearer turbine' }))
      .expect(201);
  });
});
