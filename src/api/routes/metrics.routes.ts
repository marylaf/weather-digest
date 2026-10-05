import { Router } from 'express';
import { getMetrics } from '../controllers/metrics.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const metricsRouter = Router();

metricsRouter.get('/', asyncHandler(getMetrics));

export { metricsRouter };
