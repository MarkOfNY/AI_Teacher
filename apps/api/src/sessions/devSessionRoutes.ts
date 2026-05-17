import { Router } from 'express';
import { devSessionService } from './devSessionService';

export interface DevSessionServiceLike {
  ensureUserSession(): Promise<unknown>;
}

export function createDevSessionRouter(service: DevSessionServiceLike = devSessionService) {
  const router = Router();

  router.post('/', async (_req, res, next) => {
    try {
      const session = await service.ensureUserSession();
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
