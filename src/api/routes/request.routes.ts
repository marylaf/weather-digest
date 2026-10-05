import { Router } from 'express';
import {
  createRequest,
  deleteRequest,
  getRequestById,
  importRequests,
  issueSparePart,
  listRequestHistory,
  listRequests,
  removeAssignee,
  replaceAssignees,
  updateRequest,
  updateRequestStatus,
} from '../controllers/request.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAssignedTechnician, requireRoles } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { issueSparePartBodySchema } from '../validators/sparePart.js';
import {
  createRequestBodySchema,
  importRequestsBodySchema,
  replaceAssigneesBodySchema,
  requestAssigneeParamsSchema,
  requestIdParamsSchema,
  requestListQuerySchema,
  updateRequestBodySchema,
  updateRequestStatusBodySchema,
} from '../validators/request.js';

const requestRouter = Router();

requestRouter.get('/', validate({ query: requestListQuerySchema }), asyncHandler(listRequests));
requestRouter.post(
  '/',
  requireRoles('technician', 'admin'),
  validate({ body: createRequestBodySchema }),
  asyncHandler(createRequest),
);
requestRouter.post(
  '/import',
  requireRoles('technician', 'admin'),
  validate({ body: importRequestsBodySchema }),
  asyncHandler(importRequests),
);
requestRouter.patch(
  '/:id/status',
  requireRoles('technician', 'admin'),
  validate({ params: requestIdParamsSchema, body: updateRequestStatusBodySchema }),
  requireAssignedTechnician,
  asyncHandler(updateRequestStatus),
);
requestRouter.get(
  '/:id/history',
  validate({ params: requestIdParamsSchema }),
  asyncHandler(listRequestHistory),
);
requestRouter.post(
  '/:id/spare-parts',
  requireRoles('admin'),
  validate({ params: requestIdParamsSchema, body: issueSparePartBodySchema }),
  asyncHandler(issueSparePart),
);
requestRouter.post(
  '/:id/assignees',
  requireRoles('admin'),
  validate({ params: requestIdParamsSchema, body: replaceAssigneesBodySchema }),
  asyncHandler(replaceAssignees),
);
requestRouter.delete(
  '/:id/assignees/:userId',
  requireRoles('admin'),
  validate({ params: requestAssigneeParamsSchema }),
  asyncHandler(removeAssignee),
);
requestRouter.get(
  '/:id',
  validate({ params: requestIdParamsSchema }),
  asyncHandler(getRequestById),
);
requestRouter.patch(
  '/:id',
  requireRoles('technician', 'admin'),
  validate({ params: requestIdParamsSchema, body: updateRequestBodySchema }),
  asyncHandler(updateRequest),
);
requestRouter.delete(
  '/:id',
  requireRoles('admin'),
  validate({ params: requestIdParamsSchema }),
  asyncHandler(deleteRequest),
);

export { requestRouter };
