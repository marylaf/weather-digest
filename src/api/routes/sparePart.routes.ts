import { Router } from 'express';
import {
  createSparePart,
  deleteSparePart,
  getSparePart,
  listSpareParts,
} from '../controllers/sparePart.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { idParamsSchema } from '../validators/common.js';
import { createSparePartBodySchema, sparePartListQuerySchema } from '../validators/sparePart.js';

const sparePartRouter = Router();

sparePartRouter.get(
  '/',
  validate({ query: sparePartListQuerySchema }),
  asyncHandler(listSpareParts),
);
sparePartRouter.post(
  '/',
  validate({ body: createSparePartBodySchema }),
  asyncHandler(createSparePart),
);
sparePartRouter.get('/:id', validate({ params: idParamsSchema }), asyncHandler(getSparePart));
sparePartRouter.delete('/:id', validate({ params: idParamsSchema }), asyncHandler(deleteSparePart));

export { sparePartRouter };
