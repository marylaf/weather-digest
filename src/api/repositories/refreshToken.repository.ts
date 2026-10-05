import { RefreshToken } from '../../db/models/refreshToken.js';
import { ensureDb } from './db.js';

export async function saveRefreshToken(input: {
  id: string;
  userId: string;
  expiresAt: Date;
}): Promise<void> {
  ensureDb();
  await RefreshToken.create({
    id: input.id,
    userId: input.userId,
    expiresAt: input.expiresAt,
    revokedAt: null,
  });
}

export async function isRefreshTokenActive(id: string, userId: string): Promise<boolean> {
  ensureDb();
  const row = await RefreshToken.findOne({ where: { id, userId } });

  if (!row || row.revokedAt) {
    return false;
  }

  return row.expiresAt.getTime() > Date.now();
}

export async function revokeRefreshToken(id: string): Promise<void> {
  ensureDb();
  await RefreshToken.update({ revokedAt: new Date() }, { where: { id, revokedAt: null } });
}
