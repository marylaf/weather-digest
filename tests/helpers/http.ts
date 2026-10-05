import type { Response } from 'supertest';
import request from 'supertest';
import { signAccessToken } from '../../src/api/services/auth.service.js';
import { app } from '../../src/api/app.js';
import type { AccessPrincipal } from '../../src/types/auth.js';
import type { CreateEquipmentInput } from '../../src/types/equipment.js';
import type { Equipment } from '../../src/types/equipment.js';
import type { CreateRequestInput, MaintenanceRequest } from '../../src/types/request.js';
import { equipmentPayload, requestPayload } from './fixtures.js';

const TEST_ADMIN: AccessPrincipal = {
  id: '00000000-0000-4000-8000-0000000000aa',
  role: 'admin',
  technicianId: null,
};

type ApiClient = ReturnType<typeof request>;
type ApiMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

/**
 * Клиент существующих CRUD-тестов: каждый запрос идёт от имени admin.
 * Проверки без токена используют anonymousApi().
 */
export function api(): ApiClient {
  const client = request(app);
  const methods = client as ApiClient &
    Record<ApiMethod, (url: string) => ReturnType<ApiClient['get']>>;

  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const) {
    const original = methods[method].bind(methods);
    methods[method] = (url: string) => withApiKey(original(url));
  }

  return client;
}

export function anonymousApi(): ApiClient {
  return request(app);
}

export function withApiKey<T extends { set: (field: string, value: string) => T }>(req: T): T {
  return req.set('Authorization', `Bearer ${signAccessToken(TEST_ADMIN)}`);
}

export function withBearer<T extends { set: (field: string, value: string) => T }>(
  req: T,
  accessToken: string,
): T {
  return req.set('Authorization', `Bearer ${accessToken}`);
}

export async function createEquipment(
  overrides: Partial<CreateEquipmentInput> = {},
): Promise<Equipment> {
  const response = await withApiKey(api().post('/api/equipment'))
    .send(equipmentPayload(overrides))
    .expect(201);
  return response.body.data as Equipment;
}

export async function createRequest(
  equipmentId: string,
  overrides: Partial<CreateRequestInput> = {},
): Promise<MaintenanceRequest> {
  const response = await withApiKey(api().post('/api/requests'))
    .send(requestPayload(equipmentId, overrides))
    .expect(201);
  return response.body.data as MaintenanceRequest;
}

export function expectApiError(response: Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    error: expect.objectContaining({
      code,
      message: expect.any(String),
      requestId: expect.any(String),
    }),
  });
}
