import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { loadConfig } from '../config/appConfig.js';
import { createCorsMiddleware } from './middlewares/cors.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { httpMetrics } from './middlewares/httpMetrics.js';
import { notFound } from './middlewares/notFound.js';
import { apiRateLimiter } from './middlewares/rateLimit.js';
import { requestId } from './middlewares/requestId.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { requireAccessToken } from './middlewares/requireAccessToken.js';
import { authRouter } from './routes/auth.routes.js';
import { equipmentRouter } from './routes/equipment.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { metricsRouter } from './routes/metrics.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { requestRouter } from './routes/request.routes.js';
import { siteRouter } from './routes/site.routes.js';
import { sparePartRouter } from './routes/sparePart.routes.js';

const { jsonBodyLimit } = loadConfig();
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const app = express();

app.set('trust proxy', 1);

app.use(requestId);
app.use(requestLogger);
// До роутов: на finish уже есть код ответа и шаблон пути, а не конкретный id.
app.use(httpMetrics);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(createCorsMiddleware());
app.use(express.json({ limit: jsonBodyLimit }));
app.use('/api', apiRateLimiter);
app.use('/api/auth', authRouter);
app.use('/api', healthRouter);
app.use('/api/equipment', requireAccessToken, equipmentRouter);
app.use('/api/requests', requireAccessToken, requestRouter);
app.use('/api/spare-parts', requireAccessToken, sparePartRouter);
app.use('/api/sites', requireAccessToken, siteRouter);
app.use('/api/reports', requireAccessToken, reportRouter);
app.use('/metrics', metricsRouter);
app.use(express.static(publicDir));
app.use(notFound);
app.use(errorHandler);

export { app };
