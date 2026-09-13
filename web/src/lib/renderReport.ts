import type { CityWeather, Units } from '../types';

export interface ReportStyles {
  card: string;
  title: string;
  meta: string;
  tableWrap: string;
  table: string;
  empty: string;
  error: string;
}

function getUnitLabels(units: Units): { temperature: string; precipitation: string } {
  if (units === 'imperial') {
    return { temperature: '°F', precipitation: 'in' };
  }

  return { temperature: '°C', precipitation: 'мм' };
}

function formatCoordinate(value: number): string {
  return value.toFixed(2);
}

function formatTemperature(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

function createCell(tag: 'th' | 'td', text: string): HTMLTableCellElement {
  const cell = document.createElement(tag);
  cell.textContent = text;
  return cell;
}

/**
 * Рисует отчёт через DOM API: createElement / append / replaceChildren.
 */
export function renderReport(
  container: HTMLElement,
  report: CityWeather,
  styles: ReportStyles,
): void {
  const card = document.createElement('article');
  card.className = styles.card;

  const title = document.createElement('h2');
  title.className = styles.title;
  title.textContent = `${report.city}, ${report.country}`;

  const meta = document.createElement('p');
  meta.className = styles.meta;
  meta.textContent = `Координаты: ${formatCoordinate(report.coordinates.latitude)}, ${formatCoordinate(report.coordinates.longitude)}`;

  card.append(title, meta);

  if (report.forecast.length === 0) {
    const empty = document.createElement('p');
    empty.className = styles.empty;
    empty.textContent = 'В отчёте нет дней прогноза.';
    card.append(empty);
    container.replaceChildren(card);
    return;
  }

  const tableWrap = document.createElement('div');
  tableWrap.className = styles.tableWrap;

  const table = document.createElement('table');
  table.className = styles.table;

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const labels = getUnitLabels(report.units);
  for (const header of ['Дата', `Мин. ${labels.temperature}`, `Макс. ${labels.temperature}`, 'Осадки']) {
    headRow.append(createCell('th', header));
  }
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  for (const day of report.forecast) {
    const row = document.createElement('tr');
    row.append(
      createCell('td', formatDate(day.date)),
      createCell('td', formatTemperature(day.minTemperature)),
      createCell('td', formatTemperature(day.maxTemperature)),
      createCell('td', `${day.precipitation} ${labels.precipitation}`),
    );
    tbody.append(row);
  }

  table.append(thead, tbody);
  tableWrap.append(table);
  card.append(tableWrap);
  container.replaceChildren(card);
}

export function renderMessage(container: HTMLElement, message: string, className: string): void {
  const paragraph = document.createElement('p');
  paragraph.className = className;
  paragraph.textContent = message;
  container.replaceChildren(paragraph);
}
