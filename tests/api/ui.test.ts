import { api } from '../helpers/http.js';

describe('страница заявок', () => {
  it('отдаёт HTML со списком и формой создания', async () => {
    const response = await api().get('/').expect(200);

    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.text).toContain('Заявки на обслуживание');
    expect(response.text).toContain('id="filters-form"');
    expect(response.text).toContain('id="create-form"');
    expect(response.text).not.toContain('id="auth-title"');
    expect(response.text).toContain('/requests.js');
  });

  it('отдаёт клиентский скрипт с fetch к /api/requests', async () => {
    const response = await api().get('/requests.js').expect(200);

    expect(response.headers['content-type']).toMatch(/javascript|ecmascript/);
    expect(response.text).toContain('/api/requests');
    expect(response.text).toContain('X-API-Key');
  });
});
