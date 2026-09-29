import {
  api,
  createEquipment,
  createRequest,
  expectApiError,
  withApiKey,
} from '../helpers/http.js';
import { resetStore } from '../helpers/store.js';

describe('/api/spare-parts', () => {
  beforeEach(async () => {
    await resetStore();
  });

  it('списывает остаток в одной операции и показывает расход в карточке заявки', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);
    const created = await withApiKey(api().post('/api/spare-parts'))
      .send({ name: 'Подшипник', sku: 'BRG-1', stockQuantity: 5 })
      .expect(201);

    const issued = await withApiKey(api().post(`/api/requests/${requestItem.id}/spare-parts`))
      .send({ sparePartId: created.body.data.id, quantity: 2 })
      .expect(200);

    expect(issued.body.data.spareParts).toEqual([
      {
        id: created.body.data.id,
        name: 'Подшипник',
        sku: 'BRG-1',
        quantity: '2.00',
      },
    ]);

    const part = await api().get(`/api/spare-parts/${created.body.data.id}`).expect(200);
    expect(part.body.data.stockQuantity).toBe('3.00');
  });

  it('откатывает списание, если остатка не хватает или запчасть уже выдана', async () => {
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);
    const created = await withApiKey(api().post('/api/spare-parts'))
      .send({ name: 'Сальник', sku: 'SEL-1', stockQuantity: 2 })
      .expect(201);

    const shortage = await withApiKey(
      api().post(`/api/requests/${requestItem.id}/spare-parts`),
    ).send({ sparePartId: created.body.data.id, quantity: 3 });
    expectApiError(shortage, 409, 'CONFLICT');

    await withApiKey(api().post(`/api/requests/${requestItem.id}/spare-parts`))
      .send({ sparePartId: created.body.data.id, quantity: 1 })
      .expect(200);

    const duplicate = await withApiKey(
      api().post(`/api/requests/${requestItem.id}/spare-parts`),
    ).send({ sparePartId: created.body.data.id, quantity: 1 });
    expectApiError(duplicate, 409, 'CONFLICT');

    const part = await api().get(`/api/spare-parts/${created.body.data.id}`).expect(200);
    expect(part.body.data.stockQuantity).toBe('1.00');
  });

  it('возвращает 404 для неизвестной запчасти и 409 для занятого sku', async () => {
    await withApiKey(api().post('/api/spare-parts'))
      .send({ name: 'Болт', sku: 'BLT-1', stockQuantity: 3 })
      .expect(201);
    const duplicate = await withApiKey(api().post('/api/spare-parts')).send({
      name: 'Болт 2',
      sku: 'BLT-1',
      stockQuantity: 1,
    });
    expectApiError(duplicate, 409, 'CONFLICT');

    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);
    const missing = await withApiKey(
      api().post(`/api/requests/${requestItem.id}/spare-parts`),
    ).send({ sparePartId: '00000000-0000-4000-8000-000000000099', quantity: 1 });
    expectApiError(missing, 404, 'NOT_FOUND');
  });

  it('снова принимает sku после скрытия запчасти', async () => {
    const created = await withApiKey(api().post('/api/spare-parts'))
      .send({ name: 'Фильтр', sku: 'FLT-1', stockQuantity: 4 })
      .expect(201);
    await withApiKey(api().delete(`/api/spare-parts/${created.body.data.id}`)).expect(204);

    const again = await withApiKey(api().post('/api/spare-parts'))
      .send({ name: 'Фильтр новый', sku: 'FLT-1', stockQuantity: 1 })
      .expect(201);
    expect(again.body.data.id).not.toBe(created.body.data.id);

    const list = await api().get('/api/spare-parts').query({ q: 'FLT-1' }).expect(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({ sku: 'FLT-1', name: 'Фильтр новый' }),
    ]);
  });
});
