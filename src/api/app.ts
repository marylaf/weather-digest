import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import { equipmentRouter } from './routes/equipment.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { requestRouter } from './routes/request.routes.js';

const app = express();

app.use(express.json());
app.use('/api', healthRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/requests', requestRouter);
app.use(errorHandler);

export { app };
