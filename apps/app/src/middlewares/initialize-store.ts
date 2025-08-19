import { type NextFunction, type Request, type Response } from 'express';
import { initializeStore } from '../lib/request-store';

export function initializeStoreMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  initializeStore(next);
}
