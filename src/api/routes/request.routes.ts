import { Router } from 'express';
import {
  createRequest,
  deleteRequest,
  getRequestById,
  listRequests,
  updateRequest,
} from '../controllers/request.controller.js';

const requestRouter = Router();

requestRouter.get('/', listRequests);
requestRouter.post('/', createRequest);
requestRouter.get('/:id', getRequestById);
requestRouter.patch('/:id', updateRequest);
requestRouter.delete('/:id', deleteRequest);

export { requestRouter };
