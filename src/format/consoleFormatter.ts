import { CityNotFoundError } from '../errors/appError.js';
import type { CityWeather } from '../types/weather.js';

export function formatWeather(weather: CityWeather): string {
  const { latitude, longitude } = weather.coordinates;
  const header = [
    `${weather.city}, ${weather.country}`,
    `Координаты: ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`,
  ].join('\n');

  return `${header}\n\n${formatForecastTable(weather)}`;
}

export function formatCityError(city: string, error: Error): string {
  const detail = error instanceof CityNotFoundError ? 'город не найден' : error.message;
  return `Ошибка для города "${city}": ${detail}`;
}

function formatForecastTable(weather: CityWeather): string {
  const headers = ['Дата', 'Мин. °C', 'Макс. °C', 'Осадки'];
  const rows = weather.forecast.map((day) => [
    day.date,
    formatTemperature(day.minTemperature),
    formatTemperature(day.maxTemperature),
    `${day.precipitation} мм`,
  ]);

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );

  const line = (left: string, mid: string, right: string): string =>
    `${left}${widths.map((width) => '─'.repeat(width + 2)).join(mid)}${right}`;

  const cells = (values: string[]): string =>
    `│${values.map((value, index) => ` ${value.padEnd(widths[index] ?? 0)} `).join('│')}│`;

  return [
    line('┌', '┬', '┐'),
    cells(headers),
    line('├', '┼', '┤'),
    ...rows.map((row) => cells(row)),
    line('└', '┴', '┘'),
  ].join('\n');
}

function formatCoordinate(value: number): string {
  return value.toFixed(2);
}

function formatTemperature(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
