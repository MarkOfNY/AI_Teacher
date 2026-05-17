import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { createAiRouterRoutes } from './ai/aiRoutes';
import { createClassroomRouter } from './classroom/classroomRoutes';
import { createMaterialRouter } from './materials/materialRoutes';
import { createProfileRouter } from './profile/profileRoutes';
import { createDevSessionRouter } from './sessions/devSessionRoutes';
import { createTtsRouter } from './tts/ttsRoutes';

export function createApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/dev-session', createDevSessionRouter());
  app.use('/classroom', createClassroomRouter());
  app.use('/ai', createAiRouterRoutes());
  app.use('/materials', createMaterialRouter());
  app.use('/profile', createProfileRouter());
  app.use('/tts', createTtsRouter());

  const jsonErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  };
  app.use(jsonErrorHandler);

  return app;
}
