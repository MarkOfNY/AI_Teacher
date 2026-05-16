import express from 'express';
import { rm, readFile } from 'node:fs/promises';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createAiRouterRoutes } from './aiRoutes';
import { AiProviderError } from './providers/providerErrors';

function testApp() {
  const app = express();
  app.use(express.json());
  app.use('/ai', createAiRouterRoutes({
    simplifyText: async () => 'A simpler explanation.',
    explainContext: async () => 'This matters because it connects to the event.',
    explainGaps: async () => 'Focus on the missing cause and result.',
    defineVocabulary: async () => 'Liberty means freedom in this sentence.'
  }));
  return app;
}

describe('ai routes', () => {
  afterEach(async () => {
    await rm('logs/ai-errors.log', { force: true });
  });

  it('simplifies selected text', async () => {
    const response = await request(testApp())
      .post('/ai/simplify')
      .send({ text: 'Complex text.', readingLevel: 'simple', provider: 'deepseek' });

    expect(response.status).toBe(200);
    expect(response.body.text).toBe('A simpler explanation.');
    expect(response.body.provider).toBe('deepseek');
  });

  it('explains context for selected text', async () => {
    const response = await request(testApp())
      .post('/ai/explain-context')
      .send({ text: 'The Boston Tea Party mattered.', provider: 'deepseek' });

    expect(response.status).toBe(200);
    expect(response.body.explanation).toContain('connects');
  });

  it('explains missed ideas after a failed paraphrase', async () => {
    const response = await request(testApp())
      .post('/ai/explain-gaps')
      .send({ text: 'Original chunk.', missed: ['cause', 'result'], provider: 'deepseek' });

    expect(response.status).toBe(200);
    expect(response.body.explanation).toContain('missing');
  });

  it('defines vocabulary using the selected text and surrounding context', async () => {
    const response = await request(testApp())
      .post('/ai/define')
      .send({ term: 'liberty', contextText: 'People have liberty.', provider: 'deepseek' });

    expect(response.status).toBe(200);
    expect(response.body.definition).toContain('freedom');
  });

  it('returns a specific AI error and logs the provider failure', async () => {
    const app = express();
    app.use(express.json());
    app.use('/ai', createAiRouterRoutes({
      simplifyText: async () => {
        throw new AiProviderError('DeepSeek', 402, 'Insufficient Balance code: invalid_request_error');
      },
      explainContext: async () => 'unused',
      explainGaps: async () => 'unused',
      defineVocabulary: async () => 'unused'
    }));

    const response = await request(app)
      .post('/ai/simplify')
      .send({ text: 'Complex text.', readingLevel: 'simple', provider: 'deepseek' });

    expect(response.status).toBe(502);
    expect(response.body.error).toBe('The app is having difficulty completing simplifying this text with DeepSeek. Insufficient Balance code: invalid_request_error');

    const log = await readFile('logs/ai-errors.log', 'utf-8');
    expect(log).toContain('"task":"simplifying this text"');
    expect(log).toContain('"provider":"deepseek"');
    expect(log).toContain('Insufficient Balance');
  });
});
