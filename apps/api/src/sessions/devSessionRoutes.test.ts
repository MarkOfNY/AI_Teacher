import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createDevSessionRouter } from './devSessionRoutes';

function testApp() {
  const app = express();
  app.use(express.json());
  app.use('/dev-session', createDevSessionRouter({
    ensureUserSession: async () => ({
      user: { id: 'user_1', displayName: 'Demo User' }
    })
  }));
  return app;
}

describe('dev session routes', () => {
  it('returns a user profile for local browser testing', async () => {
    const response = await request(testApp()).post('/dev-session');

    expect(response.status).toBe(201);
    expect(response.body.user.id).toBe('user_1');
  });
});
