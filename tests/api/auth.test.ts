import type { Response } from 'supertest';
import { LOGIN_RATE_LIMIT_MAX } from '../../src/config/constants.js';
import { getSequelize } from '../../src/db/database.js';
import { initModels, Technician, User } from '../../src/db/models/index.js';
import { loginRateLimitStore } from '../../src/api/middlewares/rateLimit.js';
import { loadConfig } from '../../src/config/appConfig.js';
import { requestPayload } from '../helpers/fixtures.js';
import {
  anonymousApi,
  api,
  createEquipment,
  createRequest,
  expectApiError,
  withBearer,
} from '../helpers/http.js';
import { resetStore } from '../helpers/store.js';

const PASSWORD = 'password123';

describe('аутентификация и роли', () => {
  beforeEach(async () => {
    await loginRateLimitStore.resetAll();
    await resetStore();
  });

  it('оставляет health открытым и закрывает чтение без access token', async () => {
    await anonymousApi().get('/api/health').expect(200);

    const equipment = await anonymousApi().get('/api/equipment');
    expectApiError(equipment, 401, 'UNAUTHORIZED');
    expect(equipment.headers['www-authenticate']).toMatch(/Bearer/i);
  });

  it('регистрирует viewer и не возвращает пароль', async () => {
    const response = await anonymousApi()
      .post('/api/auth/register')
      .send({ email: 'Viewer@Example.com', password: PASSWORD, role: 'admin' })
      .expect(201);

    expect(response.body.data).toEqual({
      id: expect.any(String),
      email: 'viewer@example.com',
      role: 'viewer',
      technicianId: null,
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    expect(JSON.stringify(response.body)).not.toMatch(/\$2[aby]\$/);
  });

  it('отвечает одинаково на неизвестного пользователя и неверный пароль', async () => {
    const missing = await anonymousApi()
      .post('/api/auth/login')
      .send({ email: 'missing@example.com', password: PASSWORD });
    expectApiError(missing, 401, 'UNAUTHORIZED');

    await anonymousApi()
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: PASSWORD })
      .expect(201);

    const wrong = await anonymousApi()
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrong-password' });

    expectApiError(wrong, 401, 'UNAUTHORIZED');
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('выдаёт access token и refresh cookie, затем обновляет и завершает сессию', async () => {
    await anonymousApi()
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: PASSWORD })
      .expect(201);

    const login = await anonymousApi()
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: PASSWORD })
      .expect(200);
    const cookie = cookieHeader(login.headers['set-cookie']);

    expect(login.body.data).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: loadConfig().accessTokenTtlSeconds,
      user: {
        id: expect.any(String),
        email: 'user@example.com',
        role: 'viewer',
        technicianId: null,
      },
    });
    expect(login.body.data.refreshToken).toBeUndefined();
    expect(cookie).toMatch(/refreshToken=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);
    expect(cookie.includes('Secure')).toBe(loadConfig().cookieSecure);

    const me = await withBearer(
      anonymousApi().get('/api/auth/me'),
      login.body.data.accessToken,
    ).expect(200);
    expect(me.body.data).toEqual(login.body.data.user);

    const refreshed = await anonymousApi()
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.data.tokenType).toBe('Bearer');

    await anonymousApi().post('/api/auth/logout').set('Cookie', cookie).expect(204);
    const afterLogout = await anonymousApi().post('/api/auth/refresh').set('Cookie', cookie);
    expectApiError(afterLogout, 401, 'UNAUTHORIZED');
  });

  it('не принимает refresh token вместо access token', async () => {
    await anonymousApi()
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: PASSWORD })
      .expect(201);
    const login = await anonymousApi()
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: PASSWORD })
      .expect(200);
    const refreshToken = cookieValue(login.headers['set-cookie']);

    const response = await anonymousApi()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshToken}`);
    expectApiError(response, 401, 'UNAUTHORIZED');
  });

  it('ограничивает частоту попыток входа', async () => {
    let response: Response | undefined;

    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT_MAX + 1; attempt += 1) {
      response = await anonymousApi()
        .post('/api/auth/login')
        .send({ email: 'missing@example.com', password: PASSWORD });
    }

    expectApiError(response as Response, 429, 'RATE_LIMIT_EXCEEDED');
    expect(response?.body.error.message).toBe('Too many login attempts');
  });

  it('даёт viewer только чтение, а technician — заявки и статус своей заявки', async () => {
    const viewerToken = await registerAndLogin('viewer@example.com');
    const equipment = await createEquipment();
    const requestItem = await createRequest(equipment.id);

    await withBearer(anonymousApi().get('/api/equipment'), viewerToken).expect(200);
    await withBearer(anonymousApi().get('/api/requests'), viewerToken).expect(200);
    await withBearer(anonymousApi().get('/api/reports/equipment-load'), viewerToken).expect(200);

    const forbidden = await withBearer(anonymousApi().post('/api/equipment'), viewerToken).send({
      name: 'Nope',
    });
    expectApiError(forbidden, 403, 'FORBIDDEN');

    initModels(getSequelize());
    const technician = await Technician.create({
      fullName: 'Иван Петров',
      specialization: 'Электрика',
      employeeNumber: 'T-100',
    });
    await anonymousApi()
      .post('/api/auth/register')
      .send({ email: 'tech@example.com', password: PASSWORD })
      .expect(201);
    await User.update(
      { role: 'technician', technicianId: technician.id },
      { where: { email: 'tech@example.com' } },
    );
    const technicianToken = await login('tech@example.com');

    const unassigned = await withBearer(
      anonymousApi().patch(`/api/requests/${requestItem.id}/status`),
      technicianToken,
    ).send({ status: 'rejected' });
    expectApiError(unassigned, 403, 'FORBIDDEN');

    await api()
      .post(`/api/requests/${requestItem.id}/assignees`)
      .send({ assignees: [{ technicianId: technician.id, role: 'lead' }] })
      .expect(200);

    await withBearer(
      anonymousApi().patch(`/api/requests/${requestItem.id}/status`),
      technicianToken,
    )
      .send({ status: 'rejected' })
      .expect(200);

    const ownRequest = await withBearer(anonymousApi().post('/api/requests'), technicianToken)
      .send(requestPayload(equipment.id))
      .expect(201);
    const cannotDelete = await withBearer(
      anonymousApi().delete(`/api/requests/${ownRequest.body.data.id}`),
      technicianToken,
    );
    expectApiError(cannotDelete, 403, 'FORBIDDEN');

    await api()
      .patch(`/api/requests/${ownRequest.body.data.id}/status`)
      .send({ status: 'rejected' })
      .expect(200);
  });
});

async function registerAndLogin(email: string): Promise<string> {
  await anonymousApi().post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);
  return login(email);
}

async function login(email: string): Promise<string> {
  const response = await anonymousApi()
    .post('/api/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.data.accessToken as string;
}

function cookieHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join('\n') : (value ?? '');
}

function cookieValue(value: string | string[] | undefined): string {
  const match = cookieHeader(value).match(/refreshToken=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}
