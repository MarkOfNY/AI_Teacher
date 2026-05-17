import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createMaterialRouter } from './materialRoutes';

function testApp(overrides: Partial<Parameters<typeof createMaterialRouter>[0]> = {}) {
  const material = {
    id: 'mat_1',
    title: 'History',
    originalText: 'A.',
    status: 'notStarted',
    finalBestScore: null,
    chunks: [
      { id: 'chunk_1', materialId: 'mat_1', index: 0, text: 'A.', status: 'notStarted', bestScore: null }
    ]
  };
  const app = express();
  app.use(express.json());
  app.use('/materials', createMaterialRouter({
    createMaterial: async (input) => ({
      id: 'mat_1',
      title: input.title,
      originalText: input.originalText,
      readingPartCount: input.readingPartCount,
      chunks: [
        { id: 'chunk_1', materialId: 'mat_1', index: 0, text: 'A.', status: 'notStarted', bestScore: null }
      ]
    }),
    listMaterials: async () => [material],
    getMaterial: async (id) => (id === 'mat_1' ? material : null),
    updateMaterial: async (input) => ({
      ...material,
      title: input.title,
      originalText: input.originalText
    }),
    deleteMaterial: async () => undefined,
    updateReadingParts: async (input) => ({
      ...material,
      chunks: Array.from({ length: input.readingPartCount }, (_unused, index) => ({
        id: `chunk_${index + 1}`,
        materialId: input.materialId,
        index,
        text: `${index + 1}.`,
        status: 'notStarted',
        bestScore: null
      }))
    }),
    suggestReadingParts: async () => ({ readingPartCount: 2 }),
    submitParaphraseAttempt: async () => ({
      score: 91,
      passed: true,
      rubric: { mainIdea: 90, keyDetails: 90, context: 90, whyItMatters: 95, accuracy: 90 },
      understood: ['main idea'],
      missed: [],
      feedback: 'Strong paraphrase.'
    }),
    ...overrides
  }));
  return app;
}

describe('material routes', () => {
  it('creates material from pasted text', async () => {
    const response = await request(testApp())
      .post('/materials')
      .send({ userProfileId: 'student_1', title: 'History', originalText: 'A.' });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('History');
    expect(response.body.chunks).toHaveLength(1);
  });

  it('accepts a requested number of reading parts', async () => {
    const response = await request(testApp())
      .post('/materials')
      .send({ userProfileId: 'student_1', title: 'History', originalText: 'A. B.', readingPartCount: 2 });

    expect(response.status).toBe(201);
    expect(response.body.readingPartCount).toBe(2);
  });

  it('rejects empty text', async () => {
    const response = await request(testApp())
      .post('/materials')
      .send({ userProfileId: 'student_1', title: 'History', originalText: '' });

    expect(response.status).toBe(400);
  });

  it('lists materials for a student profile', async () => {
    const response = await request(testApp()).get('/materials?userProfileId=student_1');

    expect(response.status).toBe(200);
    expect(response.body[0].title).toBe('History');
  });

  it('gets one material with chunks for reading', async () => {
    const response = await request(testApp()).get('/materials/mat_1');

    expect(response.status).toBe(200);
    expect(response.body.chunks).toHaveLength(1);
  });

  it('updates one material title and text', async () => {
    const updateMaterial = vi.fn().mockResolvedValue({
      id: 'mat_1',
      title: 'Updated History',
      originalText: 'New text.',
      chunks: []
    });

    const response = await request(testApp({ updateMaterial }))
      .patch('/materials/mat_1')
      .send({ title: 'Updated History', originalText: 'New text.' });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Updated History');
    expect(updateMaterial).toHaveBeenCalledWith({
      materialId: 'mat_1',
      title: 'Updated History',
      originalText: 'New text.'
    });
  });

  it('deletes one material', async () => {
    const deleteMaterial = vi.fn().mockResolvedValue(undefined);

    const response = await request(testApp({ deleteMaterial })).delete('/materials/mat_1');

    expect(response.status).toBe(204);
    expect(deleteMaterial).toHaveBeenCalledWith('mat_1');
  });

  it('updates reading parts after material creation', async () => {
    const response = await request(testApp())
      .patch('/materials/mat_1/reading-parts')
      .send({ readingPartCount: 3 });

    expect(response.status).toBe(200);
    expect(response.body.chunks).toHaveLength(3);
  });

  it('suggests a reading part count for a material', async () => {
    const suggestReadingParts = vi.fn().mockResolvedValue({ readingPartCount: 2 });
    const response = await request(testApp({ suggestReadingParts }))
      .post('/materials/mat_1/reading-parts/suggestion')
      .send({ provider: 'deepseek' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ readingPartCount: 2 });
    expect(suggestReadingParts).toHaveBeenCalledWith('mat_1', 'deepseek');
  });

  it('defaults suggested reading part chunking to Qwen', async () => {
    const suggestReadingParts = vi.fn().mockResolvedValue({ readingPartCount: 2 });

    const response = await request(testApp({ suggestReadingParts }))
      .post('/materials/mat_1/reading-parts/suggestion')
      .send();

    expect(response.status).toBe(200);
    expect(suggestReadingParts).toHaveBeenCalledWith('mat_1', 'qwen');
  });

  it('scores a chunk paraphrase attempt', async () => {
    const response = await request(testApp())
      .post('/materials/mat_1/attempts')
      .send({ scope: 'chunk', chunkId: 'chunk_1', transcript: 'A clear paraphrase.' });

    expect(response.status).toBe(201);
    expect(response.body.score).toBe(91);
    expect(response.body.passed).toBe(true);
  });
});
