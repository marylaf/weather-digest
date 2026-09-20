import type { Response } from 'supertest';
import request from 'supertest';
import { app } from '../../src/api/app.js';
import type { CreateEquipmentInput } from '../../src/types/equipment.js';
import type { Equipment } from '../../src/types/equipment.js';
import type { CreateRequestInput, MaintenanceRequest } from '../../src/types/request.js';
import { equipmentPayload, requestPayload } from './fixtures.js';

export function api(): ReturnType<typeof request> {
  return request(app);
}

export async function createEquipment(
  overrides: Partial<CreateEquipmentInput> = {},
): Promise<Equipment> {
  const response = await api().post('/api/equipment').send(equipmentPayload(overrides)).expect(201);
  return response.body.data as Equipment;
}

export async function createRequest(
  equipmentId: string,
  overrides: Partial<CreateRequestInput> = {},
): Promise<MaintenanceRequest> {
  const response = await api()
    .post('/api/requests')
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
