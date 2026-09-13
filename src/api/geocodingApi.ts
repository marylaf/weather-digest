import { loadConfig } from '../config/appConfig.js';
import { CityNotFoundError, InvalidApiResponseError } from '../errors/appError.js';
import type { GeoLocation } from '../types/geocoding.js';
import { isRecord } from '../utils/isRecord.js';
import { httpGetJson } from './httpClient.js';

export async function getCoordinates(city: string): Promise<GeoLocation> {
  const { geocodingUrl } = loadConfig();
  const url = new URL(geocodingUrl);
  url.searchParams.set('name', city);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'ru');
  url.searchParams.set('format', 'json');

  const payload = await httpGetJson(url.toString());
  return parseGeocodingResponse(payload, city);
}

function parseGeocodingResponse(payload: unknown, city: string): GeoLocation {
  if (!isRecord(payload)) {
    throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (геокодинг)');
  }

  const { results } = payload;

  if (
    results === undefined ||
    results === null ||
    (Array.isArray(results) && results.length === 0)
  ) {
    throw new CityNotFoundError(`Город "${city}" не найден`);
  }

  if (!Array.isArray(results)) {
    throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (геокодинг)');
  }

  const first = results[0];

  if (!isRecord(first)) {
    throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (геокодинг)');
  }

  const { name, country, latitude, longitude } = first;

  if (
    typeof name !== 'string' ||
    typeof country !== 'string' ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new InvalidApiResponseError('Неожиданная структура ответа Open-Meteo (геокодинг)');
  }

  return { name, country, latitude, longitude };
}
