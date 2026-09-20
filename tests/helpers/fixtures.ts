import { randomUUID } from 'node:crypto';
import type { CreateEquipmentInput } from '../../src/types/equipment.js';
import type { CreateRequestInput } from '../../src/types/request.js';

export function equipmentPayload(
  overrides: Partial<CreateEquipmentInput> = {},
): CreateEquipmentInput {
  return {
    name: 'Test turbine',
    type: 'turbine',
    serialNumber: `SN-${randomUUID()}`,
    location: { lat: 55.75, lon: 37.62 },
    status: 'operational',
    installedAt: '2024-06-01',
    ...overrides,
  };
}

export function requestPayload(
  equipmentId: string,
  overrides: Partial<CreateRequestInput> = {},
): CreateRequestInput {
  return {
    equipmentId,
    title: 'Inspect turbine blades',
    description: 'Routine visual inspection',
    priority: 'medium',
    ...overrides,
  };
}

export function forecastApiResponse(): Record<string, unknown> {
  return {
    daily: {
      time: ['2026-09-20', '2026-09-21', '2026-09-22'],
      temperature_2m_min: [7.7, 9.1, 10.9],
      temperature_2m_max: [16.2, 19.2, 17.3],
      precipitation_sum: [0, 0, 0.5],
      wind_speed_10m_max: [4.2, 5.1, 6],
    },
  };
}
