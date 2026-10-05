FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.json .sequelizerc ./
COPY src ./src
COPY scripts ./scripts

RUN npm ci && npm run build

FROM build AS migrate

CMD ["sh", "-c", "node scripts/ensure-app-role.cjs && npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all"]

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production \
    REPORTS_DIR=/app/reports \
    EQUIPMENT_FILE=/app/data/equipment.json \
    REQUESTS_FILE=/app/data/requests.json

RUN addgroup -S app \
    && adduser -S app -G app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && mkdir -p /app/reports /app/data /app/public \
    && chown -R app:app /app

COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app public ./public

USER app

CMD ["node", "dist/api/server.js"]
