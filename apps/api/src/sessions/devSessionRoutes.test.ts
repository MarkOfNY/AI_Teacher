import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createDevSessionRouter } from './devSessionRoutes';

function testApp() {
  const app = express();
  app.use(express.json());
  app.use('/dev-session', createDevSessionRouter({
    ensureParentSession: async () => ({
      parent: { id: 'parent_1', displayName: 'Parent' },
      student: { id: 'student_1', displayName: 'Student' }
    })
  }));
  return app;
}

describe('dev session routes', () => {
  it('returns a parent and student profile for local browser testing', async () => {
    const response = await request(testApp()).post('/dev-session');

    expect(response.status).toBe(201);
    expect(response.body.student.id).toBe('student_1');
  });
});
