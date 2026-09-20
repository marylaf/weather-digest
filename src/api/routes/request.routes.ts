import { Router } from 'express';
import {
  createRequest,
  deleteRequest,
  getRequestById,
  listRequests,
  updateRequest,
  updateRequestStatus,
} from '../controllers/request.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import {
  createRequestBodySchema,
  requestIdParamsSchema,
  requestListQuerySchema,
  updateRequestBodySchema,
  updateRequestStatusBodySchema,
} from '../validators/request.js';

const requestRouter = Router();

requestRouter.get('/', validate({ query: requestListQuerySchema }), asyncHandler(listRequests));
requestRouter.post('/', validate({ body: createRequestBodySchema }), asyncHandler(createRequest));
requestRouter.patch(
  '/:id/status',
  validate({ params: requestIdParamsSchema, body: updateRequestStatusBodySchema }),
  asyncHandler(updateRequestStatus),
);
requestRouter.get(
  '/:id',
  validate({ params: requestIdParamsSchema }),
  asyncHandler(getRequestById),
);
requestRouter.patch(
  '/:id',
  validate({ params: requestIdParamsSchema, body: updateRequestBodySchema }),
  asyncHandler(updateRequest),
);
requestRouter.delete(
  '/:id',
  validate({ params: requestIdParamsSchema }),
  asyncHandler(deleteRequest),
);

export { requestRouter };
