import { jest } from '@jest/globals';
import { Sequelize } from 'sequelize';
import { api, createEquipment, createRequest } from '../helpers/http.js';
import { resetStore } from '../helpers/store.js';

const MISSING_EQUIPMENT_ID = '11111111-1111-4111-8111-111111111111';

describe('GET /metrics', () => {
  beforeEach(async () => {
    await resetStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('отдаёт счётчики запросов, маршрут, код и длительность', async () => {
    await api().get('/api/health/live').expect(200);
    await api().get(`/api/equipment/${MISSING_EQUIPMENT_ID}`).expect(404);

    const response = await api().get('/metrics').expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('http_requests_total');
    expect(response.text).toContain('route="/api/health/live"');
    expect(response.text).toContain('status_code="200"');
    expect(response.text).toContain('route="/api/equipment/:id"');
    expect(response.text).toContain('status_code="404"');
    expect(response.text).toContain('http_request_duration_seconds_bucket');
    expect(response.text).toContain('http_request_errors_total');
    expect(response.text).not.toContain(MISSING_EQUIPMENT_ID);
    expect(response.text).not.toContain('requestId=');
    expect(response.text).not.toContain('userId');
  });

  it('считает ответы 5xx отдельно от 4xx', async () => {
    jest
      .spyOn(Sequelize.prototype, 'authenticate')
      .mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    await api().get('/api/health/ready').expect(503);
    await api().get('/api/unknown-route-for-metrics').expect(404);

    const response = await api().get('/metrics').expect(200);
    const errorLines = response.text
      .split('\n')
      .filter((line) => line.startsWith('http_request_errors_total{'));

    expect(response.text).toContain('route="unmatched"');
    expect(response.text).toContain('status_code="404"');
    expect(response.text).not.toContain('unknown-route-for-metrics');
    expect(errorLines.some((line) => line.includes('status_code="503"'))).toBe(true);
    expect(errorLines.some((line) => line.includes('status_code="404"'))).toBe(false);
  });

  it('показывает заявки и нагрузку на оборудование из базы', async () => {
    const equipment = await createEquipment();
    await createRequest(equipment.id, { priority: 'high' });

    const response = await api().get('/metrics').expect(200);

    expect(response.text).toContain('maintenance_requests_current{status="new"} 1');
    expect(response.text).toContain('maintenance_requests_by_priority{priority="high"} 1');
    expect(response.text).toContain('maintenance_requests_by_priority{priority="low"} 0');
    expect(response.text).toContain('equipment_request_count{equipment="Test turbine"} 1');
    expect(response.text).toContain('# TYPE maintenance_request_close_seconds gauge');
  });
});
