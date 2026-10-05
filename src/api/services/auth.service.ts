import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../../config/appConfig.js';
import { UnauthorizedError } from '../../errors/httpErrors.js';
import { isUserRole, type AccessPrincipal, type PublicUser } from '../../types/auth.js';
import { isRecord } from '../../utils/isRecord.js';
import * as refreshTokenRepository from '../repositories/refreshToken.repository.js';
import * as userRepository from '../repositories/user.repository.js';

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_ACCESS = 'Missing or invalid access token';
const INVALID_REFRESH = 'Missing or invalid refresh token';

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
  refreshToken: string;
}

export async function register(email: string, password: string): Promise<PublicUser> {
  const passwordHash = await bcrypt.hash(password, 12);
  return userRepository.createViewer(email.trim().toLowerCase(), passwordHash);
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await userRepository.findAuthByEmail(email.trim().toLowerCase());

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  const refresh = signRefreshToken(user.id);
  await refreshTokenRepository.saveRefreshToken({
    id: refresh.jti,
    userId: user.id,
    expiresAt: refresh.expiresAt,
  });

  return {
    accessToken: signAccessToken(user),
    expiresIn: loadConfig().accessTokenTtlSeconds,
    user: publicUser(user),
    refreshToken: refresh.token,
  };
}

export async function refresh(refreshToken: string | undefined): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  if (!refreshToken) {
    throw new UnauthorizedError(INVALID_REFRESH);
  }

  const claims = verifyRefreshToken(refreshToken);
  const active = await refreshTokenRepository.isRefreshTokenActive(claims.jti, claims.userId);

  if (!active) {
    throw new UnauthorizedError(INVALID_REFRESH);
  }

  const user = await userRepository.findPublicById(claims.userId);

  if (!user) {
    throw new UnauthorizedError(INVALID_REFRESH);
  }

  return {
    accessToken: signAccessToken(user),
    expiresIn: loadConfig().accessTokenTtlSeconds,
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }

  try {
    const claims = verifyRefreshToken(refreshToken);
    await refreshTokenRepository.revokeRefreshToken(claims.jti);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return;
    }

    throw error;
  }
}

export async function currentUser(userId: string): Promise<PublicUser> {
  const user = await userRepository.findPublicById(userId);

  if (!user) {
    throw new UnauthorizedError(INVALID_ACCESS);
  }

  return user;
}

export function signAccessToken(user: AccessPrincipal): string {
  const { accessTokenSecret, accessTokenTtlSeconds } = loadConfig();

  if (!accessTokenSecret) {
    throw new Error('Missing required environment variable: JWT_ACCESS_SECRET');
  }

  return jwt.sign(
    {
      role: user.role,
      technicianId: user.technicianId,
      typ: 'access',
    },
    accessTokenSecret,
    { subject: user.id, expiresIn: accessTokenTtlSeconds },
  );
}

export function verifyAccessToken(token: string): AccessPrincipal {
  const { accessTokenSecret } = loadConfig();

  if (!accessTokenSecret) {
    throw new Error('Missing required environment variable: JWT_ACCESS_SECRET');
  }

  try {
    const payload = jwt.verify(token, accessTokenSecret);
    const principal = readAccessPrincipal(payload);

    if (!principal) {
      throw new UnauthorizedError(INVALID_ACCESS);
    }

    return principal;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    throw new UnauthorizedError(INVALID_ACCESS);
  }
}

function signRefreshToken(userId: string): { token: string; jti: string; expiresAt: Date } {
  const { refreshTokenSecret, refreshTokenTtlSeconds } = loadConfig();

  if (!refreshTokenSecret) {
    throw new Error('Missing required environment variable: JWT_REFRESH_SECRET');
  }

  const jti = randomUUID();
  const token = jwt.sign({ typ: 'refresh' }, refreshTokenSecret, {
    subject: userId,
    jwtid: jti,
    expiresIn: refreshTokenTtlSeconds,
  });

  return {
    token,
    jti,
    expiresAt: new Date(Date.now() + refreshTokenTtlSeconds * 1000),
  };
}

function verifyRefreshToken(token: string): { userId: string; jti: string } {
  const { refreshTokenSecret } = loadConfig();

  if (!refreshTokenSecret) {
    throw new Error('Missing required environment variable: JWT_REFRESH_SECRET');
  }

  try {
    const payload = jwt.verify(token, refreshTokenSecret);

    if (
      !isRecord(payload) ||
      payload.typ !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      throw new UnauthorizedError(INVALID_REFRESH);
    }

    return { userId: payload.sub, jti: payload.jti };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    throw new UnauthorizedError(INVALID_REFRESH);
  }
}

function readAccessPrincipal(payload: unknown): AccessPrincipal | null {
  if (!isRecord(payload) || payload.typ !== 'access' || typeof payload.sub !== 'string') {
    return null;
  }

  if (!isUserRole(payload.role)) {
    return null;
  }

  if (
    payload.technicianId !== undefined &&
    payload.technicianId !== null &&
    typeof payload.technicianId !== 'string'
  ) {
    return null;
  }

  return {
    id: payload.sub,
    role: payload.role,
    technicianId: typeof payload.technicianId === 'string' ? payload.technicianId : null,
  };
}

function publicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    technicianId: user.technicianId,
  };
}
