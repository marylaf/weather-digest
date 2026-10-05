import type { CookieOptions, Request, Response } from 'express';
import { loadConfig } from '../../config/appConfig.js';
import { UnauthorizedError } from '../../errors/httpErrors.js';
import * as authService from '../services/auth.service.js';

const REFRESH_COOKIE = 'refreshToken';

export async function register(req: Request, res: Response): Promise<void> {
  const body = req.body as { email: string; password: string };
  const data = await authService.register(body.email, body.password);
  res.status(201).json({ data });
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body as { email: string; password: string };
  const result = await authService.login(body.email, body.password);
  const { refreshTokenTtlSeconds } = loadConfig();

  res.cookie(REFRESH_COOKIE, result.refreshToken, {
    ...cookieOptions(),
    maxAge: refreshTokenTtlSeconds * 1000,
  });
  res.status(200).json({
    data: {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: result.expiresIn,
      user: result.user,
    },
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const result = await authService.refresh(readRefreshCookie(req));
  res.status(200).json({
    data: {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: result.expiresIn,
    },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req));
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError('Missing or invalid access token');
  }

  const data = await authService.currentUser(req.user.id);
  res.status(200).json({ data });
}

function cookieOptions(): CookieOptions {
  const { cookieSecure, cookieSameSite } = loadConfig();

  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/api/auth',
  };
}

function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie ?? '';
  const match = header.match(/(?:^|;\s*)refreshToken=([^;]+)/);
  const value = match?.[1];

  if (!value) {
    return undefined;
  }

  return decodeURIComponent(value);
}
