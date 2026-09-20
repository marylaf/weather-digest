import { api } from '../helpers/http.js';

describe('GET /api/health', () => {
  it('возвращает статус ok', async () => {
    const response = await api().get('/api/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });
});
