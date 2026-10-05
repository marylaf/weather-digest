import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../errors/httpErrors.js';
import type { AccessPrincipal, UserRole } from '../../types/auth.js';
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
  const requestId = typeof req.params.id === 'string' ? req.params.id : undefined;
  let requestFound = false;
  let isAssigned = false;

  if (user && user.role !== 'admin' && requestId !== undefined) {
    const request = await requestRepository.findById(requestId);
    requestFound = request !== null;

    if (requestFound && user.technicianId) {
      isAssigned = await requestRepository.isTechnicianAssigned(requestId, user.technicianId);
    }
  }

  assertAssignedTechnicianAccess({
    user,
    requestId,
    requestFound,
    isAssigned,
  });
}

export function assertAssignedTechnicianAccess(input: {
  user: AccessPrincipal | undefined;
  requestId: string | undefined;
  requestFound: boolean;
  isAssigned: boolean;
}): void {
  if (!input.user) {
    throw new UnauthorizedError('Missing or invalid access token');
  }

  if (input.user.role === 'admin') {
    return;
  }

  if (input.requestId === undefined) {
    throw new ForbiddenError('Technician is not assigned to this request');
  }

  if (!input.requestFound) {
    return;
  }

  if (!input.user.technicianId || !input.isAssigned) {
    throw new ForbiddenError('Technician is not assigned to this request');
  }
}
