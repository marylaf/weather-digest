import express from 'express';
import helmet from 'helmet';
import { loadConfig } from '../config/appConfig.js';
import { createCorsMiddleware } from './middlewares/cors.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { apiRateLimiter } from './middlewares/rateLimit.js';
import { requestId } from './middlewares/requestId.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { requireApiKey } from './middlewares/requireApiKey.js';
import { equipmentRouter } from './routes/equipment.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { requestRouter } from './routes/request.routes.js';

const { jsonBodyLimit } = loadConfig();
const app = express();

app.use(requestId);
app.use(requestLogger);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(createCorsMiddleware());
app.use(express.json({ limit: jsonBodyLimit }));
app.use('/api', apiRateLimiter);
app.use('/api', requireApiKey);
app.use('/api', healthRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/requests', requestRouter);
app.use(notFound);
app.use(errorHandler);

export { app };
