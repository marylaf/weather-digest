import { Router } from 'express';
import { login, logout, me, refresh, register } from '../controllers/auth.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { loginRateLimiter } from '../middlewares/rateLimit.js';
import { requireAccessToken } from '../middlewares/requireAccessToken.js';
import { validate } from '../middlewares/validate.js';
import { loginBodySchema, registerBodySchema } from '../validators/auth.js';

const authRouter = Router();

authRouter.post('/register', validate({ body: registerBodySchema }), asyncHandler(register));
authRouter.post(
  '/login',
  loginRateLimiter,
  validate({ body: loginBodySchema }),
  asyncHandler(login),
);
authRouter.post('/refresh', asyncHandler(refresh));
authRouter.post('/logout', asyncHandler(logout));
authRouter.get('/me', requireAccessToken, asyncHandler(me));

export { authRouter };
