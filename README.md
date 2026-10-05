# Weather Digest

Учебный проект: API для учёта оборудования и заявок на обслуживание. По координатам площадки можно спросить прогноз Open-Meteo и понять, подходит ли погода для работ на улице.

Стек: Node.js, Express, PostgreSQL, Sequelize. Схема накатывается миграциями.

## Запуск

Нужны Node.js 20, npm и Docker. Копирую `.env.example` в `.env`. В git пароли не кладу: в примере стоят заглушки `change_me`, их нужно заменить. Для API обязательны `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET`. Для compose обязательны `DB_NAME`, `DB_USER`, `DB_PASSWORD` и `GRAFANA_ADMIN_PASSWORD`.

Локально, API на машине, база в Docker:

```bash
npm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --wait postgres
npm run db:migrate
npm run db:seed
npm run api
```

API: http://localhost:3000. Документация: http://localhost:3000/api/docs.

`docker-compose.dev.yml` публикует Postgres только на `127.0.0.1`. В обычном compose порты базы и API наружу не открыты.

Весь стенд (nginx, api, postgres, prometheus, grafana) вместе с миграциями и сидами:

```bash
docker compose up -d --build
```

Снаружи только порт 80. Запросы идут на http://localhost, Swagger — http://localhost/api/docs. Повторить миграции и сиды: `docker compose run --rm migrate`.

Остановить и удалить данные: `docker compose down -v`.

## Пользователи из сида

`npm run db:seed` создаёт площадки, оборудование, заявки и трёх пользователей. Пароль у всех `password123`.

| email              | роль                                   |
| ------------------ | -------------------------------------- |
| admin@example.com  | admin                                  |
| tech@example.com   | technician, привязан к технику Иванову |
| viewer@example.com | viewer                                 |

Регистрация `POST /api/auth/register` всегда создаёт `viewer`, даже если в теле передать другую роль.

## Авторизация

Логин: `POST /api/auth/login` с email и паролем. В ответе `accessToken`, refresh-токен лежит в cookie `refreshToken` (HttpOnly, путь `/api/auth`). Дальше заголовок `Authorization: Bearer <accessToken>`.

Ещё есть `POST /api/auth/refresh`, `POST /api/auth/logout` и `GET /api/auth/me`.

Без токена на рабочие маршруты — `401`. Токен есть, но роль не та — `403`. Читать может любая роль. Заявки создаёт и меняет статус техник или админ. Статус чужой заявки техник сменить не может. Оборудование, бригаду и запчасти меняет только админ.

На `POST /api/auth/login` отдельный лимит: 10 попыток за 15 минут, потом `429`.

`/api/health`, `/api/health/live` и `/api/health/ready` без токена. `ready` смотрит в PostgreSQL и при недоступной базе отвечает `503`.

## Что есть в API

- оборудование: `/api/equipment`, `/api/equipment/:id/weather`, `/api/equipment/:id/requests`
- заявки: `/api/requests`, импорт, статус, история, бригада, запчасти на заявке
- запчасти: `/api/spare-parts`
- сводка: `/api/sites/:id/summary`
- отчёт: `/api/reports/equipment-load`

Статус заявки: `new` → `in_progress` или `rejected`, `in_progress` → `done` или `rejected`. В `in_progress` без бригады не пускает. Оборудование с открытыми заявками удалить нельзя.

Ошибка: `{ "error": { "code", "message", "requestId" } }`.

Погода: `outdoorWorkSuitable` по первому дню прогноза. Осадков 0 и ветер меньше `MAX_WIND_SPEED` (по умолчанию 10).

## Метрики и Grafana

`GET /metrics` отдаёт Prometheus. В полном compose его снаружи закрывает nginx basic auth: логин `metrics`, пароль `change_me_metrics`. Grafana: http://localhost/grafana/ (тот же basic auth, внутри логин `admin` и пароль из `GRAFANA_ADMIN_PASSWORD`). Дашборд и алерт «API недоступен» поднимаются сами из `deploy/grafana`.

На графике заявок смотреть `maintenance_requests_current`: после создания и закрытия заявки счётчик меняется на следующем сборе, интервал Prometheus 15 секунд.

## Команды

- `npm run api` — сервер
- `npm run api:dev` — с перезапуском
- `npm test` — Jest
- `npm run test:coverage` — те же тесты и отчёт в `coverage/`
- `npm run lint` — eslint и prettier
- `npm run db:migrate` — миграции
- `npm run db:migrate:undo` — откатить последнюю
- `npm run db:seed` — демо-данные и пользователи
- `npm run db:seed:undo:all` — откатить сиды
- `npm run web` — vite на порту 5173, сохранённые отчёты CLI
- `npm start -- --city "Москва"` — консольная сводка погоды, это не API

Коллекция Postman: `docs/postman/Equipment Maintenance API.postman_collection.json`. Сначала папка Auth, она кладёт `accessToken`. Для `npm run api` переменная `baseUrl` — `http://localhost:3000`. Для стенда из `docker compose up` её нужно поменять на `http://localhost`.
