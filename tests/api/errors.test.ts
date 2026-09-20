import { api, expectApiError } from '../helpers/http.js';

describe('общие ошибки API', () => {
  it('возвращает 404 для неизвестного маршрута', async () => {
    const response = await api().get('/api/unknown');
    expectApiError(response, 404, 'NOT_FOUND');
  });

  it('возвращает 400 для некорректного JSON', async () => {
    const response = await api()
      .post('/api/equipment')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expectApiError(response, 400, 'VALIDATION_ERROR');
  });
});
