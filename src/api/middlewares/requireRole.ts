import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../errors/httpErrors.js';
import type { UserRole } from '../../types/auth.js';
import * as requestRepository from '../repositories/request.repository.js';

/**
 * Пускает только перечисленные роли. Аутентификация уже должна быть выполнена.
 */
export function requireRoles(...allowed: readonly UserRole[]): RequestHandler {
  const roles = new Set<UserRole>(allowed);

  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError('Missing or invalid access token'));
      return;
    }

    if (!roles.has(req.user.role)) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}

/**
 * Admin меняет статус любой заявки. Technician — только если он назначен на неё.
 * Несуществующая заявка остаётся 404 на уровне сервиса.
 */
export const requireAssignedTechnician: RequestHandler = (req, _res, next) => {
  void assertAssigned(req).then(
    () => {
      next();
    },
    (error: unknown) => {
      next(error);
    },
  );
};

async function assertAssigned(req: Parameters<RequestHandler>[0]): Promise<void> {
  const user = req.user;

  if (!user) {
    throw new UnauthorizedError('Missing or invalid access token');
  }

  if (user.role === 'admin') {
    return;
  }

  const requestId = req.params.id;

  if (typeof requestId !== 'string') {
    throw new ForbiddenError('Technician is not assigned to this request');
  }

  const request = await requestRepository.findById(requestId);

  if (!request) {
    return;
  }

  if (!user.technicianId) {
    throw new ForbiddenError('Technician is not assigned to this request');
  }

  const assigned = await requestRepository.isTechnicianAssigned(requestId, user.technicianId);

  if (!assigned) {
    throw new ForbiddenError('Technician is not assigned to this request');
  }
}
