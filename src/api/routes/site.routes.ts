import { Router } from 'express';
import { getSiteSummary } from '../controllers/report.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { idParamsSchema } from '../validators/common.js';

const siteRouter = Router();

siteRouter.get('/:id/summary', validate({ params: idParamsSchema }), asyncHandler(getSiteSummary));

export { siteRouter };
