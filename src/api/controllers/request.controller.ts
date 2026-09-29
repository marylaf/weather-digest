import type { Request, Response } from 'express';
import type {
  CreateRequestInput,
  ReplaceAssigneesInput,
  RequestListQuery,
  RequestStatus,
  UpdateRequestInput,
} from '../../types/request.js';
import type { IssueSparePartInput } from '../../types/sparePart.js';
import * as requestService from '../services/request.service.js';
import * as sparePartService from '../services/sparePart.service.js';

export async function listRequests(req: Request, res: Response): Promise<void> {
  const result = await requestService.listRequests(req.query as RequestListQuery);
  res.status(200).json(result);
}

export async function createRequest(req: Request, res: Response): Promise<void> {
  const data = await requestService.createRequest(req.body as CreateRequestInput);
  res.status(201).location(`/api/requests/${data.id}`).json({ data });
}

export async function importRequests(req: Request, res: Response): Promise<void> {
  const result = await requestService.importRequests((req.body as { items: unknown[] }).items);
  res.status(result.meta.failed === 0 ? 201 : 207).json(result);
}

export async function getRequestById(req: Request, res: Response): Promise<void> {
  const data = await requestService.getRequestById(req.params.id as string);
  res.status(200).json({ data });
}

export async function updateRequest(req: Request, res: Response): Promise<void> {
  const data = await requestService.updateRequest(
    req.params.id as string,
    req.body as UpdateRequestInput,
  );
  res.status(200).json({ data });
}

export async function updateRequestStatus(req: Request, res: Response): Promise<void> {
  const body = req.body as { status: RequestStatus; comment?: string };
  const data = await requestService.updateRequestStatus(
    req.params.id as string,
    body.status,
    body.comment,
  );
  res.status(200).json({ data });
}

export async function replaceAssignees(req: Request, res: Response): Promise<void> {
  const data = await requestService.replaceRequestAssignees(
    req.params.id as string,
    req.body as ReplaceAssigneesInput,
  );
  res.status(200).json({ data });
}

export async function removeAssignee(req: Request, res: Response): Promise<void> {
  await requestService.removeRequestAssignee(req.params.id as string, req.params.userId as string);
  res.status(204).end();
}

export async function listRequestHistory(req: Request, res: Response): Promise<void> {
  const data = await requestService.listRequestStatusHistory(req.params.id as string);
  res.status(200).json({ data });
}

export async function issueSparePart(req: Request, res: Response): Promise<void> {
  const data = await sparePartService.issueSparePart(
    req.params.id as string,
    req.body as IssueSparePartInput,
  );
  res.status(200).json({ data });
}

export async function deleteRequest(req: Request, res: Response): Promise<void> {
  await requestService.deleteRequest(req.params.id as string);
  res.status(204).end();
}

export async function listRequestsByEquipmentId(req: Request, res: Response): Promise<void> {
  const result = await requestService.listRequestsByEquipmentId(
    req.params.id as string,
    req.query as RequestListQuery,
  );
  res.status(200).json(result);
}
