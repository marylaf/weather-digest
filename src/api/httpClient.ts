import { loadConfig } from '../config/appConfig.js';
import {
  HttpStatusError,
  InvalidJsonError,
  NetworkError,
  TimeoutError,
  isAppError,
} from '../errors/appError.js';

export async function httpGetJson(url: string): Promise<unknown> {
  const { timeoutMs } = loadConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (response.status >= 400 && response.status < 500) {
      throw new HttpStatusError(`Open-Meteo вернул ошибку ${response.status}`, response.status);
    }

    if (response.status >= 500) {
      throw new HttpStatusError(
        `Open-Meteo временно недоступен: HTTP ${response.status}`,
        response.status,
      );
    }

    if (!response.ok) {
      throw new HttpStatusError(
        `Open-Meteo вернул неожиданный статус ${response.status}`,
        response.status,
      );
    }

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new InvalidJsonError('Open-Meteo вернул некорректный JSON', { cause: error });
    }
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new TimeoutError(`Превышено время ожидания запроса (${timeoutMs} мс)`, {
        cause: error,
      });
    }

    throw new NetworkError('Не удалось подключиться к Open-Meteo', { cause: error });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
