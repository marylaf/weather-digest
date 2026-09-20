FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

RUN npm ci && npm run build

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production \
    REPORTS_DIR=/app/reports

RUN addgroup -S app \
    && adduser -S app -G app \
    && mkdir -p /app/reports \
    && chown -R app:app /app

COPY --from=build --chown=app:app /app/package.json ./
COPY --from=build --chown=app:app /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=build --chown=app:app /app/dist ./dist

USER app

CMD ["node", "dist/index.js"]
