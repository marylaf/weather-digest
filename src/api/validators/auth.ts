import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .min(3, { error: 'Некорректный email' })
  .max(254, { error: 'Некорректный email' })
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { error: 'Некорректный email' });

const passwordSchema = z
  .string()
  .min(8, { error: 'Пароль должен быть не короче 8 символов' })
  .max(128, { error: 'Пароль должен быть не длиннее 128 символов' });

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
