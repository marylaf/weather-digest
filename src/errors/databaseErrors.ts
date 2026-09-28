import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from 'sequelize';
import { ConflictError, NotFoundError, ValidationError } from './httpErrors.js';
import type { HttpAppError } from './httpErrors.js';

const SERIAL_CONFLICT = 'Equipment with this serialNumber already exists';

/**
 * Maps expected PostgreSQL failures to API errors.
 * Sequelize messages and stack traces stay in logs, not in the response.
 */
export function mapDatabaseError(error: unknown): HttpAppError | null {
  if (error instanceof UniqueConstraintError) {
    return new ConflictError(isSerialConflict(error) ? SERIAL_CONFLICT : 'Resource already exists');
  }

  if (error instanceof ForeignKeyConstraintError) {
    const constraint = readConstraint(error);
    if (constraint.includes('equipment_id')) {
      return new NotFoundError('Equipment not found');
    }

    return new NotFoundError('Related resource not found');
  }

  if (error instanceof SequelizeValidationError) {
    return new ValidationError(
      error.errors.map((item) => ({
        field: item.path ?? 'body',
        message: 'Некорректные данные запроса',
      })),
      'Некорректные данные запроса',
      400,
    );
  }

  const code = readPgCode(error);

  if (code === '23505') {
    return new ConflictError(
      constraintName(error).includes('serial') ? SERIAL_CONFLICT : 'Resource already exists',
    );
  }

  if (code === '23503') {
    const constraint = constraintName(error);
    return new NotFoundError(
      constraint.includes('equipment_id') ? 'Equipment not found' : 'Related resource not found',
    );
  }

  if (code === '23502' || code === '23514') {
    return new ValidationError(
      [{ field: 'body', message: 'Некорректные данные запроса' }],
      'Некорректные данные запроса',
      400,
    );
  }

  if (code === '22P02') {
    return new NotFoundError('Resource not found');
  }

  if (code === 'P0001') {
    return new ConflictError('Related records do not allow this change');
  }

  return null;
}

export function isUniqueConstraint(error: unknown): boolean {
  return error instanceof UniqueConstraintError || readPgCode(error) === '23505';
}

function isSerialConflict(error: UniqueConstraintError): boolean {
  if (constraintName(error).includes('serial')) {
    return true;
  }

  return Object.keys(error.fields ?? {}).some((field) => field.includes('serial'));
}

function constraintName(error: unknown): string {
  return readConstraint(error);
}

function readConstraint(error: unknown): string {
  if (!isRecord(error)) {
    return '';
  }

  if (typeof error.constraint === 'string') {
    return error.constraint;
  }

  if ('parent' in error) {
    const parent = readConstraint(error.parent);
    if (parent) {
      return parent;
    }
  }

  if ('original' in error) {
    return readConstraint(error.original);
  }

  return '';
}

function readPgCode(error: unknown): string {
  if (!isRecord(error)) {
    return '';
  }

  if (typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code)) {
    return error.code;
  }

  if ('parent' in error) {
    const parent = readPgCode(error.parent);
    if (parent) {
      return parent;
    }
  }

  if ('original' in error) {
    return readPgCode(error.original);
  }

  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
