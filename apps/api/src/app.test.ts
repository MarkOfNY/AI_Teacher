import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('api app', () => {
  it('returns health status', async () => {
    const app = createApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
