import { Router } from 'express';
import { getLive, getReady } from '../controllers/health.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const healthRouter = Router();

healthRouter.get('/health/live', getLive);
healthRouter.get('/health/ready', asyncHandler(getReady));
// Прежний путь оставлен: его уже вызывает docker healthcheck.
healthRouter.get('/health', getLive);

export { healthRouter };
