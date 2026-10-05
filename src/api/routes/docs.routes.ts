import { Router } from 'express';
import { serveWithOptions, setup } from 'swagger-ui-express';
import { openApiDocument } from '../openapi.js';

const docsRouter = Router();

// Helmet ставит жёсткий CSP раньше. Swagger UI рисует страницу своими скриптами.
docsRouter.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
  );
  next();
});

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

docsRouter.use(serveWithOptions({ redirect: false }));
docsRouter.get(
  '/',
  setup(openApiDocument, {
    customSiteTitle: 'Equipment Maintenance API',
  }),
);

export { docsRouter };
