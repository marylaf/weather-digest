import { jest } from '@jest/globals';
import { Sequelize } from 'sequelize';
import { api } from '../helpers/http.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('GET /api/health/live', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('возвращает 200 и не проверяет базу', async () => {
    const authenticate = jest.spyOn(Sequelize.prototype, 'authenticate');
    const response = await api().get('/api/health/live').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('использует безопасный входящий X-Request-Id', async () => {
    const response = await api()
      .get('/api/health/live')
      .set('X-Request-Id', 'student-req-01')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('student-req-01');
  });

  it('заменяет небезопасный X-Request-Id новым', async () => {
    const response = await api()
      .get('/api/health/live')
      .set('X-Request-Id', 'bad/request')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(UUID_PATTERN);
  });
});

describe('GET /api/health/ready', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('возвращает 200, если PostgreSQL доступен', async () => {
    jest.spyOn(Sequelize.prototype, 'authenticate').mockResolvedValue();

    const response = await api().get('/api/health/ready').expect(200);

    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('возвращает 503 not ready, если PostgreSQL недоступен', async () => {
    jest
      .spyOn(Sequelize.prototype, 'authenticate')
      .mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    const response = await api().get('/api/health/ready').expect(503);

    expect(response.body).toEqual({ status: 'not ready', database: 'down' });
  });
});

describe('GET /api/health', () => {
  it('остаётся проверкой живости процесса', async () => {
    const response = await api().get('/api/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });
});
