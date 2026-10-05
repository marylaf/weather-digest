export const USER_ROLES = ['viewer', 'technician', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Пользователь из access token. Пароля и хеша здесь нет. */
export interface AccessPrincipal {
  id: string;
  role: UserRole;
  technicianId: string | null;
}

/** Публичное представление пользователя в ответах API. */
export interface PublicUser extends AccessPrincipal {
  email: string;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.some((role) => role === value);
}
