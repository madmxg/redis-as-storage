import { randomUUID } from 'node:crypto';
import { type NextFunction, type Request, type Response } from 'express';

import { RDocumentLoader } from '../lib/RDocumentLoader/RDocumentLoader';
import { setStoreValue } from '../lib/request-store';
import { redis } from '../lib/redis';

export function populateStoreMiddleware(req: Request, _res: Response, next: NextFunction): void {
  setStoreValue('requestId', req.get('x-request-id') ?? randomUUID());
  setStoreValue('loader', RDocumentLoader.createInstance(redis));
  next();
}
