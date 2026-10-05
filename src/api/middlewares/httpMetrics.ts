import type { Request, RequestHandler } from 'express';
import { Counter, Histogram, Registry } from 'prom-client';

// Отдельный registry, чтобы в /metrics не попало ничего лишнего.
export const register = new Registry();

// method, route и status_code — короткие метки.
// userId, email, requestId и полный URL с id сюда не кладём: таких значений слишком много.
const httpLabelNames = ['method', 'route', 'status_code'] as const;

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Сколько HTTP-запросов обработал API',
  labelNames: httpLabelNames,
  registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Сколько секунд заняла обработка запроса',
  labelNames: httpLabelNames,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Только ответы 5xx. 4xx остаются в http_requests_total по status_code.
export const httpRequestErrorsTotal = new Counter({
  name: 'http_request_errors_total',
  help: 'Сколько ответов с кодом 500 и выше',
  labelNames: httpLabelNames,
  registers: [register],
});

/**
 * Считает запросы после ответа.
 * Сам /metrics не считаем, иначе опрос Prometheus раздувает график.
 */
export const httpMetrics: RequestHandler = (req, res, next) => {
  if (isMetricsPath(req.path)) {
    next();
    return;
  }

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, seconds);

    if (res.statusCode >= 500) {
      httpRequestErrorsTotal.inc(labels);
    }
  });

  next();
};

function isMetricsPath(path: string): boolean {
  return path === '/metrics' || path === '/metrics/';
}

// Нужен шаблон вроде /api/equipment/:id, а не uuid из адреса.
// Если маршрут не найден, пишем unmatched: сырой путь может быть любым.
// У ошибки Express 5 к finish уже очищает baseUrl, шаблон остаётся в req.route.path.
function routeLabel(req: Request): string {
  const routePath = req.route?.path;

  if (typeof routePath !== 'string' || routePath.length === 0) {
    return 'unmatched';
  }

  if (req.baseUrl) {
    return routePath === '/' ? req.baseUrl : `${req.baseUrl}${routePath}`;
  }

  return applyRouteTemplate(req.path, routePath);
}

function applyRouteTemplate(pathname: string, routePath: string): string {
  if (routePath === '/') {
    return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  }

  const routeParts = routePath.split('/').filter((part) => part.length > 0);
  const pathParts = pathname.split('/').filter((part) => part.length > 0);
  const prefix = pathParts.slice(0, Math.max(pathParts.length - routeParts.length, 0));

  return `/${[...prefix, ...routeParts].join('/')}`;
}
