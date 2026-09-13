export class AppError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class HttpStatusError extends AppError {
  readonly status: number;

  constructor(message: string, status: number, options?: { cause?: unknown }) {
    super(message, options);
    this.status = status;
  }
}

export class TimeoutError extends AppError {}

export class NetworkError extends AppError {}

export class InvalidJsonError extends AppError {}

export class InvalidApiResponseError extends AppError {}

export class CityNotFoundError extends AppError {}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
