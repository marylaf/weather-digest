import { isUniqueConstraint } from '../../errors/databaseErrors.js';
import { ConflictError } from '../../errors/httpErrors.js';
import type { PublicUser } from '../../types/auth.js';
import { User } from '../../db/models/user.js';
import { ensureDb } from './db.js';

export interface AuthRecord extends PublicUser {
  passwordHash: string;
}

export async function findAuthByEmail(email: string): Promise<AuthRecord | null> {
  ensureDb();
  const row = await User.unscoped().findOne({ where: { email } });
  return row ? toAuthRecord(row) : null;
}

export async function findPublicById(id: string): Promise<PublicUser | null> {
  ensureDb();
  const row = await User.findByPk(id);
  return row ? toPublicUser(row) : null;
}

export async function createViewer(email: string, passwordHash: string): Promise<PublicUser> {
  ensureDb();

  try {
    const row = await User.create({
      email,
      passwordHash,
      role: 'viewer',
      technicianId: null,
    });
    return toPublicUser(row);
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new ConflictError('User with this email already exists');
    }

    throw error;
  }
}

function toAuthRecord(row: User): AuthRecord {
  return {
    ...toPublicUser(row),
    passwordHash: row.passwordHash,
  };
}

function toPublicUser(row: User): PublicUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    technicianId: row.technicianId,
  };
}
