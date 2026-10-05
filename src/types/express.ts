import type { AccessPrincipal } from './auth.js';

export {};

declare global {
  // Express declaration merging requires a namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      user?: AccessPrincipal;
    }
  }
}
