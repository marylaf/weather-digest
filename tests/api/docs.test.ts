import { anonymousApi } from '../helpers/http.js';

describe('GET /api/docs', () => {
  it('отдаёт Swagger UI без токена', async () => {
    const response = await anonymousApi().get('/api/docs').expect(200);

    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.text).toMatch(/swagger/i);
  });

  it('отдаёт OpenAPI JSON', async () => {
    const response = await anonymousApi().get('/api/docs/openapi.json').expect(200);

    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.paths['/api/auth/login']).toBeDefined();
    expect(response.body.paths['/api/health/ready']).toBeDefined();
  });
});
