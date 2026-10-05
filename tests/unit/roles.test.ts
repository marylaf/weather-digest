import type { NextFunction, Request, Response } from 'express';
import {
  assertAssignedTechnicianAccess,
  requireAssignedTechnician,
  requireRoles,
} from '../../src/api/middlewares/requireRole.js';
import { ForbiddenError, UnauthorizedError } from '../../src/errors/httpErrors.js';
import type { AccessPrincipal, UserRole } from '../../src/types/auth.js';

const viewer: AccessPrincipal = {
  id: '00000000-0000-4000-8000-000000000001',
  role: 'viewer',
  technicianId: null,
};

const technician: AccessPrincipal = {
  id: '00000000-0000-4000-8000-000000000002',
  role: 'technician',
  technicianId: '00000000-0000-4000-8000-0000000000a1',
};

const otherTechnician: AccessPrincipal = {
  id: '00000000-0000-4000-8000-000000000003',
  role: 'technician',
  technicianId: '00000000-0000-4000-8000-0000000000a2',
};

const admin: AccessPrincipal = {
  id: '00000000-0000-4000-8000-000000000004',
  role: 'admin',
  technicianId: null,
};

function callRoles(allowed: readonly UserRole[], user?: AccessPrincipal): unknown {
  let result: unknown = 'next';
  const next: NextFunction = (error?: unknown) => {
    result = error ?? 'next';
  };

  requireRoles(...allowed)({ user } as Request, {} as Response, next);
  return result;
}

describe('права ролей viewer, technician и admin', () => {
  it('без пользователя отвечает 401', () => {
    expect(callRoles(['admin'])).toBeInstanceOf(UnauthorizedError);
    expect(callRoles(['technician', 'admin'])).toBeInstanceOf(UnauthorizedError);
  });

  it('viewer не меняет оборудование и заявки', () => {
    expect(callRoles(['admin'], viewer)).toBeInstanceOf(ForbiddenError);
    expect(callRoles(['technician', 'admin'], viewer)).toBeInstanceOf(ForbiddenError);
  });

  it('technician создаёт и меняет заявки, но не делает действия только для admin', () => {
    expect(callRoles(['technician', 'admin'], technician)).toBe('next');
    expect(callRoles(['admin'], technician)).toBeInstanceOf(ForbiddenError);
  });

  it('admin проходит и туда, куда пускают technician, и в действия только для admin', () => {
    expect(callRoles(['technician', 'admin'], admin)).toBe('next');
    expect(callRoles(['admin'], admin)).toBe('next');
  });
});

describe('technician меняет статус только назначенной ему заявки', () => {
  const requestId = '00000000-0000-4000-8000-000000000010';

  it('без пользователя отвечает 401', () => {
    expect(() =>
      assertAssignedTechnicianAccess({
        user: undefined,
        requestId,
        requestFound: true,
        isAssigned: false,
      }),
    ).toThrow(UnauthorizedError);
  });

  it('без id заявки отвечает 403', () => {
    expect(() =>
      assertAssignedTechnicianAccess({
        user: technician,
        requestId: undefined,
        requestFound: false,
        isAssigned: false,
      }),
    ).toThrow(ForbiddenError);
  });

  it('пропускает technician, если он назначен на заявку', () => {
    expect(() =>
      assertAssignedTechnicianAccess({
        user: technician,
        requestId,
        requestFound: true,
        isAssigned: true,
      }),
    ).not.toThrow();
  });

  it('запрещает technician менять чужую заявку', () => {
    expect(() =>
      assertAssignedTechnicianAccess({
        user: otherTechnician,
        requestId,
        requestFound: true,
        isAssigned: false,
      }),
    ).toThrow('Technician is not assigned to this request');
  });

  it('запрещает technician без привязки к специалисту', () => {
    const technicianWithoutCard: AccessPrincipal = {
      ...technician,
      technicianId: null,
    };

    expect(() =>
      assertAssignedTechnicianAccess({
        user: technicianWithoutCard,
        requestId,
        requestFound: true,
        isAssigned: false,
      }),
    ).toThrow(ForbiddenError);
  });

  it('admin меняет статус заявки, даже если он на неё не назначен', () => {
    expect(() =>
      assertAssignedTechnicianAccess({
        user: admin,
        requestId,
        requestFound: true,
        isAssigned: false,
      }),
    ).not.toThrow();
  });

  it('не подменяет 404, если заявки нет', () => {
    expect(() =>
      assertAssignedTechnicianAccess({
        user: technician,
        requestId,
        requestFound: false,
        isAssigned: false,
      }),
    ).not.toThrow();
  });

  it('middleware пускает admin без проверки назначения', async () => {
    const error = await runAssignedMiddleware({
      user: admin,
      params: { id: requestId },
    });

    expect(error).toBeUndefined();
  });
});

function runAssignedMiddleware(req: Pick<Request, 'user' | 'params'>): Promise<unknown> {
  return new Promise((resolve) => {
    requireAssignedTechnician(req as Request, {} as Response, (error?: unknown) => {
      resolve(error);
    });
  });
}
