/**
 * Описание API для Swagger UI на `/api/docs`.
 * Покрывает авторизацию и основные маршруты, без каждой query-комбинации.
 */
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Equipment Maintenance API',
    version: '0.1.0',
    description:
      'Учёт оборудования и заявок на обслуживание. Почти все маршруты `/api`, кроме health и login/register, требуют access token.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Equipment' },
    { name: 'Requests' },
    { name: 'Spare parts' },
    { name: 'Reports' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      Credentials: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Процесс жив',
        responses: { '200': { description: '{ status: ok }' } },
      },
    },
    '/api/health/live': {
      get: {
        tags: ['Health'],
        summary: 'Liveness, базу не проверяет',
        responses: { '200': { description: '{ status: ok }' } },
      },
    },
    '/api/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness, проверяет PostgreSQL',
        responses: {
          '200': { description: '{ status: ok, database: up }' },
          '503': { description: '{ status: not ready, database: down }' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Регистрация. Роль всегда viewer, поле role из тела игнорируется',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Credentials' } } },
        },
        responses: {
          '201': { description: 'Пользователь без пароля' },
          '422': { description: 'Валидация', content: errorContent() },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Логин. Access token в теле, refresh token в HttpOnly cookie',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Credentials' } } },
        },
        responses: {
          '200': { description: 'accessToken, tokenType, expiresIn, user' },
          '401': { description: 'Неверная пара email/пароль', content: errorContent() },
          '429': { description: 'Слишком много попыток входа', content: errorContent() },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Новый access token по cookie refreshToken',
        responses: {
          '200': { description: 'Новый access token' },
          '401': { description: 'Cookie нет или токен отозван', content: errorContent() },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Отзывает refresh token и очищает cookie',
        responses: { '204': { description: 'Пустое тело' } },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Текущий пользователь',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'id, email, role, technicianId' },
          '401': { description: 'Нет access token', content: errorContent() },
        },
      },
    },
    '/api/equipment': {
      get: {
        tags: ['Equipment'],
        summary: 'Список оборудования',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: '{ data, meta }' },
          '401': { description: 'Нет токена', content: errorContent() },
        },
      },
      post: {
        tags: ['Equipment'],
        summary: 'Создать оборудование. Только admin',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Карточка и заголовок Location' },
          '401': { description: 'Нет токена', content: errorContent() },
          '403': { description: 'Роль не admin', content: errorContent() },
        },
      },
    },
    '/api/equipment/{id}': {
      get: {
        tags: ['Equipment'],
        summary: 'Карточка оборудования',
        security: [{ bearerAuth: [] }],
        parameters: [idParam()],
        responses: { '200': { description: '{ data }' }, '404': { description: 'Нет записи' } },
      },
      patch: {
        tags: ['Equipment'],
        summary: 'Частичное обновление. Только admin',
        security: [{ bearerAuth: [] }],
        parameters: [idParam()],
        responses: {
          '200': { description: 'Обновлённая карточка' },
          '403': { description: 'Роль' },
        },
      },
      delete: {
        tags: ['Equipment'],
        summary: 'Скрыть оборудование, если нет открытых заявок. Только admin',
        security: [{ bearerAuth: [] }],
        parameters: [idParam()],
        responses: {
          '204': { description: 'Удалено' },
          '409': { description: 'Есть заявки new или in_progress' },
        },
      },
    },
    '/api/equipment/{id}/weather': {
      get: {
        tags: ['Equipment'],
        summary: 'Прогноз и флаг outdoorWorkSuitable по первому дню',
        security: [{ bearerAuth: [] }],
        parameters: [idParam()],
        responses: {
          '200': { description: 'Прогноз Open-Meteo' },
          '503': { description: 'Open-Meteo недоступен' },
        },
      },
    },
    '/api/requests': {
      get: {
        tags: ['Requests'],
        summary: 'Список заявок',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: '{ data, meta }' } },
      },
      post: {
        tags: ['Requests'],
        summary: 'Создать заявку. Technician или admin. Статус всегда new',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Карточка заявки' },
          '403': { description: 'Viewer не может создавать' },
        },
      },
    },
    '/api/requests/{id}/assignees': {
      post: {
        tags: ['Requests'],
        summary: 'Заменить бригаду. Ровно один lead. Только admin',
        security: [{ bearerAuth: [] }],
        parameters: [idParam()],
        responses: { '200': { description: 'Карточка с assignedTechnicians' } },
      },
    },
    '/api/requests/{id}/status': {
      patch: {
        tags: ['Requests'],
        summary: 'Смена статуса. Admin или назначенный technician',
        security: [{ bearerAuth: [] }],
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['new', 'in_progress', 'done', 'rejected'] },
                  comment: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Новый статус' },
          '403': { description: 'Техник не назначен на заявку' },
          '409': { description: 'Переход запрещён или нет бригады для in_progress' },
        },
      },
    },
    '/api/spare-parts': {
      get: {
        tags: ['Spare parts'],
        summary: 'Список запчастей',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: '{ data, meta }' } },
      },
      post: {
        tags: ['Spare parts'],
        summary: 'Создать запчасть. Только admin',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Карточка' }, '403': { description: 'Роль' } },
      },
    },
    '/api/sites/{id}/summary': {
      get: {
        tags: ['Reports'],
        summary: 'Сводка заявок площадки',
        security: [{ bearerAuth: [] }],
        parameters: [idParam()],
        responses: { '200': { description: 'Счётчики и среднее время закрытия' } },
      },
    },
    '/api/reports/equipment-load': {
      get: {
        tags: ['Reports'],
        summary: 'Нагрузка оборудования',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Список по оборудованию' } },
      },
    },
  },
} as const;

function idParam(): {
  name: string;
  in: 'path';
  required: true;
  schema: { type: 'string' };
} {
  return { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
}

function errorContent(): {
  'application/json': { schema: { $ref: string } };
} {
  return { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } };
}
