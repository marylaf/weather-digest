import type { Request, Response } from 'express';
import type { RequestListQuery } from '../../types/request.js';
import { HttpError } from '../errors/httpError.js';
import * as requestService from '../services/request.service.js';

export async function listRequests(req: Request, res: Response): Promise<void> {
  const result = await requestService.listRequests(parseListQuery(req.query));
  res.status(200).json(result);
}

export async function createRequest(req: Request, res: Response): Promise<void> {
  const data = await requestService.createRequest(req.body);
  res.status(201).location(`/api/requests/${data.id}`).json({ data });
}

export async function getRequestById(req: Request, res: Response): Promise<void> {
  const data = await requestService.getRequestById(requireId(req, 'request'));
  res.status(200).json({ data });
}

export async function updateRequest(req: Request, res: Response): Promise<void> {
  const data = await requestService.updateRequest(requireId(req, 'request'), req.body);
  res.status(200).json({ data });
}

export async function updateRequestStatus(req: Request, res: Response): Promise<void> {
  const data = await requestService.updateRequestStatus(requireId(req, 'request'), req.body);
  res.status(200).json({ data });
}

export async function deleteRequest(req: Request, res: Response): Promise<void> {
  await requestService.deleteRequest(requireId(req, 'request'));
  res.status(204).end();
}

function requireId(req: Request, label: string): string {
  const id = req.params.id;

  if (typeof id !== 'string' || id.trim() === '') {
    throw new HttpError(400, `Missing ${label} id`);
  }

  return id;
}

function parseListQuery(query: Request['query']): RequestListQuery {
  return {
    status: readQueryString(query.status),
    priority: readQueryString(query.priority),
    equipmentId: readQueryString(query.equipmentId),
    createdFrom: readQueryString(query.createdFrom),
    createdTo: readQueryString(query.createdTo),
    sortBy: readQueryString(query.sortBy),
    order: readQueryString(query.order),
    page: readQueryString(query.page),
    limit: readQueryString(query.limit),
  };
}

function readQueryString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim() !== '') {
    return value[0].trim();
  }

  return undefined;
}
