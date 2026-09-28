import { api, expectApiError } from '../helpers/http.js';

describe('пагинация и сортировка списков', () => {
  it('возвращает 400 для отрицательного и слишком большого limit', async () => {
    const negative = await api().get('/api/equipment').query({ limit: '-1' });
    expectApiError(negative, 400, 'VALIDATION_ERROR');

    const zero = await api().get('/api/requests').query({ limit: '0' });
    expectApiError(zero, 400, 'VALIDATION_ERROR');

    const tooLarge = await api().get('/api/equipment').query({ limit: '101' });
    expectApiError(tooLarge, 400, 'VALIDATION_ERROR');
  });

  it('возвращает 400 для отрицательной страницы и слишком большого смещения', async () => {
    const negative = await api().get('/api/requests').query({ page: '-5' });
    expectApiError(negative, 400, 'VALIDATION_ERROR');

    const huge = await api().get('/api/equipment').query({ page: '100000', limit: '100' });
    expectApiError(huge, 400, 'VALIDATION_ERROR');
  });

  it('отклоняет sortBy вне whitelist и не подставляет его в запрос', async () => {
    const response = await api()
      .get('/api/equipment')
      .query({ sortBy: 'name;DROP TABLE equipment' });

    expectApiError(response, 422, 'VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'sortBy' })]),
    );
  });
});
