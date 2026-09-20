import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['dist/**', 'web/dist/**', 'reports/**', 'node_modules/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'web/vite.config.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    files: ['web/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  eslintConfigPrettier,
);
