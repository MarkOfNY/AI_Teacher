import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { listCourses, listAssignments, importAssignment } from './classroomClient';

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

const ImportSchema = z.object({
  courseId: z.string().min(1),
  courseWorkId: z.string().min(1)
});

export function createClassroomRouter() {
  const router = Router();

  router.get('/courses', async (req, res, next) => {
    try {
      const token = extractToken(req);
      if (!token) { res.status(401).json({ error: 'Google access token required' }); return; }
      const courses = await listCourses(token);
      res.json({ courses });
    } catch (error) {
      next(error);
    }
  });

  router.get('/courses/:courseId/assignments', async (req, res, next) => {
    try {
      const token = extractToken(req);
      if (!token) { res.status(401).json({ error: 'Google access token required' }); return; }
      const assignments = await listAssignments(token, req.params.courseId);
      res.json({ assignments });
    } catch (error) {
      next(error);
    }
  });

  router.post('/import', async (req, res, next) => {
    try {
      const token = extractToken(req);
      if (!token) { res.status(401).json({ error: 'Google access token required' }); return; }
      const parsed = ImportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'courseId and courseWorkId are required' });
        return;
      }
      const result = await importAssignment(token, parsed.data.courseId, parsed.data.courseWorkId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
