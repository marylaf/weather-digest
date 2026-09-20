import express from 'express';
import { healthRouter } from './routes/health.routes.js';

const app = express();

app.use(express.json());
app.use('/api', healthRouter);

export { app };
