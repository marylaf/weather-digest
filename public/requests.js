'use strict';

const API_KEY_STORAGE = 'weatherDigestApiKey';
const EQUIPMENT_LIMIT = 100;
const PAGE_LIMIT = 10;

const STATUS_LABELS = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
};

const PRIORITY_LABELS = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

const state = {
  page: 1,
  equipment: [],
};

document.addEventListener('DOMContentLoaded', () => {
  const filtersForm = document.querySelector('#filters-form');
  const filtersReset = document.querySelector('#filters-reset');
  const createForm = document.querySelector('#create-form');
  const prevPage = document.querySelector('#prev-page');
  const nextPage = document.querySelector('#next-page');

  restoreApiKey();
  getApiKeyInput().addEventListener('change', persistApiKey);

  filtersForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.page = 1;
    void loadRequests();
  });

  filtersReset.addEventListener('click', () => {
    filtersForm.reset();
    state.page = 1;
    void loadRequests();
  });

  prevPage.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      void loadRequests();
    }
  });

  nextPage.addEventListener('click', () => {
    state.page += 1;
    void loadRequests();
  });

  createForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitRequest(createForm);
  });

  void bootstrap();
});

async function bootstrap() {
  await loadEquipment();
  await loadRequests();
}

function getApiKeyInput() {
  return document.querySelector('#api-key');
}

function restoreApiKey() {
  getApiKeyInput().value = localStorage.getItem(API_KEY_STORAGE) ?? '';
}

function persistApiKey() {
  localStorage.setItem(API_KEY_STORAGE, getApiKey());
}

function getApiKey() {
  return getApiKeyInput().value.trim();
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, auth?: boolean }} [options]
 */
async function apiFetch(path, options = {}) {
  const headers = { Accept: 'application/json' };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth) {
    const apiKey = getApiKey();
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
  }

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    cache: 'no-store',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(formatApiError(payload, response.status));
  }

  return payload;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatApiError(payload, status) {
  const error = payload?.error;
  if (!error) {
    return `Ошибка ${status}`;
  }

  const details = Array.isArray(error.details)
    ? error.details.map((item) => item.message).join('; ')
    : '';

  return details ? `${error.message}: ${details}` : error.message;
}

function buildQuery(params) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

async function loadEquipment() {
  const filterSelect = document.querySelector('#filter-equipment');
  const createSelect = document.querySelector('#create-equipment');
  const submit = document.querySelector('#create-submit');

  try {
    const result = await apiFetch(
      `/api/equipment${buildQuery({ limit: EQUIPMENT_LIMIT, sortBy: 'name' })}`,
    );
    state.equipment = result.data ?? [];
  } catch (error) {
    state.equipment = [];
    setMessage('list-message', error.message, 'error');
  }

  fillEquipmentSelect(filterSelect, 'Все', true);
  fillEquipmentSelect(createSelect, 'Выберите оборудование', false);
  submit.disabled = state.equipment.length === 0;
}

function fillEquipmentSelect(select, placeholder, includeAll) {
  const current = select.value;
  const options = [`<option value="">${placeholder}</option>`];

  for (const item of state.equipment) {
    options.push(`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`);
  }

  select.innerHTML = options.join('');

  if (includeAll || state.equipment.some((item) => item.id === current)) {
    select.value = current;
  }
}

async function loadRequests() {
  const form = document.querySelector('#filters-form');
  const data = new FormData(form);
  const query = buildQuery({
    status: data.get('status'),
    priority: data.get('priority'),
    equipmentId: data.get('equipmentId'),
    createdFrom: data.get('createdFrom'),
    createdTo: data.get('createdTo'),
    page: state.page,
    limit: PAGE_LIMIT,
    sortBy: 'createdAt',
    order: 'desc',
  });

  setMessage('list-message', '', '');

  try {
    const result = await apiFetch(`/api/requests${query}`);
    renderRequests(
      result.data ?? [],
      result.meta ?? { total: 0, page: state.page, limit: PAGE_LIMIT },
    );
  } catch (error) {
    renderRequests([], { total: 0, page: state.page, limit: PAGE_LIMIT });
    setMessage('list-message', error.message, 'error');
  }
}

function renderRequests(items, meta) {
  const body = document.querySelector('#requests-body');
  const metaLabel = document.querySelector('#list-meta');
  const prevPage = document.querySelector('#prev-page');
  const nextPage = document.querySelector('#next-page');
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit) || 1);

  if (state.page > totalPages) {
    state.page = totalPages;
  }

  if (items.length === 0) {
    body.innerHTML = '<tr><td colspan="5">Заявок нет</td></tr>';
  } else {
    body.innerHTML = items.map(renderRequestRow).join('');
  }

  metaLabel.textContent = `Страница ${meta.page} из ${totalPages} · всего ${meta.total}`;
  prevPage.disabled = meta.page <= 1;
  nextPage.disabled = meta.page >= totalPages;
}

function renderRequestRow(item) {
  const equipmentName = equipmentLabel(item.equipmentId);
  const status = STATUS_LABELS[item.status] ?? item.status;
  const priority = PRIORITY_LABELS[item.priority] ?? item.priority;

  return `<tr>
    <td>${escapeHtml(item.title)}</td>
    <td>${escapeHtml(equipmentName)}</td>
    <td><span class="badge status-${escapeHtml(item.status)}">${escapeHtml(status)}</span></td>
    <td><span class="badge priority-${escapeHtml(item.priority)}">${escapeHtml(priority)}</span></td>
    <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
  </tr>`;
}

function equipmentLabel(id) {
  return state.equipment.find((item) => item.id === id)?.name ?? id;
}

async function submitRequest(form) {
  const submit = document.querySelector('#create-submit');
  const data = new FormData(form);
  const plannedAt = toIsoDateTime(data.get('plannedAt'));
  const payload = {
    equipmentId: String(data.get('equipmentId') ?? '').trim(),
    title: String(data.get('title') ?? '').trim(),
    description: String(data.get('description') ?? '').trim(),
    priority: String(data.get('priority') ?? ''),
  };

  if (plannedAt) {
    payload.plannedAt = plannedAt;
  }

  submit.disabled = true;
  setMessage('create-message', '', '');

  try {
    persistApiKey();
    await apiFetch('/api/requests', { method: 'POST', body: payload, auth: true });
    form.reset();
    restoreApiKey();
    document.querySelector('#create-priority').value = 'medium';
    setMessage('create-message', 'Заявка создана', 'ok');
    state.page = 1;
    await loadRequests();
  } catch (error) {
    setMessage('create-message', error.message, 'error');
  } finally {
    submit.disabled = state.equipment.length === 0;
  }
}

function toIsoDateTime(value) {
  if (!value) {
    return undefined;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function setMessage(id, text, type) {
  const node = document.querySelector(`#${id}`);
  node.hidden = !text;
  node.textContent = text;
  node.className = type ? `message ${type}` : 'message';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
