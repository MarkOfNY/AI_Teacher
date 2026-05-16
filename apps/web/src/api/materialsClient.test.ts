import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDevSession,
  createMaterial,
  deleteMaterial,
  getMaterial,
  listMaterials,
  submitParaphraseAttempt,
  suggestReadingParts,
  updateMaterial,
  updateReadingParts
} from './materialsClient';

describe('materialsClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a dev parent session through the API', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ student: { id: 'student_1', displayName: 'Student' } })
    });
    vi.stubGlobal('fetch', fetch);

    const session = await createDevSession();

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/dev-session', { method: 'POST' });
    expect(session.student.id).toBe('student_1');
  });

  it('posts pasted material in the request body instead of the URL', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'material_1',
        title: 'Declaration',
        status: 'notStarted',
        finalBestScore: null
      })
    });
    vi.stubGlobal('fetch', fetch);

    const material = await createMaterial({
      studentProfileId: 'student_1',
      title: 'Declaration',
      originalText: 'A long document goes here'
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentProfileId: 'student_1',
        title: 'Declaration',
        originalText: 'A long document goes here'
      })
    });
    expect(material.title).toBe('Declaration');
  });

  it('updates reading parts after a lesson is opened', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'material_1', chunks: [{ id: 'chunk_1', index: 0, text: 'One.' }] })
    });
    vi.stubGlobal('fetch', fetch);

    await updateReadingParts({ materialId: 'material_1', readingPartCount: 4 });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/materials/material_1/reading-parts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readingPartCount: 4 })
    });
  });

  it('updates a lesson title and text through the API', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'material_1', title: 'Updated', chunks: [{ id: 'chunk_1', index: 0, text: 'New.' }] })
    });
    vi.stubGlobal('fetch', fetch);

    await updateMaterial({ materialId: 'material_1', title: 'Updated', originalText: 'New.' });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/materials/material_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated', originalText: 'New.' })
    });
  });

  it('deletes a lesson through the API', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal('fetch', fetch);

    await deleteMaterial('material_1');

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/materials/material_1', { method: 'DELETE' });
  });

  it('requests a suggested reading part count for the opened lesson', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readingPartCount: 3 })
    });
    vi.stubGlobal('fetch', fetch);

    const suggestion = await suggestReadingParts('material_1');

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/materials/material_1/reading-parts/suggestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'qwen' })
    });
    expect(suggestion.readingPartCount).toBe(3);
  });

  it('loads materials for the student workspace', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ id: 'material_1', title: 'History', status: 'notStarted', finalBestScore: null }])
    });
    vi.stubGlobal('fetch', fetch);

    const materials = await listMaterials('student_1');

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/materials?studentProfileId=student_1');
    expect(materials[0].title).toBe('History');
  });

  it('loads a material with chunks for the lesson reader', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'material_1', title: 'History', chunks: [{ id: 'chunk_1', index: 0, text: 'A.' }] })
    });
    vi.stubGlobal('fetch', fetch);

    const material = await getMaterial('material_1');

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/materials/material_1');
    expect(material.chunks).toHaveLength(1);
  });

  it('submits a paraphrase attempt through the API', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ score: 88, passed: false, feedback: 'Add the key detail.' })
    });
    vi.stubGlobal('fetch', fetch);

    const result = await submitParaphraseAttempt({
      materialId: 'material_1',
      chunkId: 'chunk_1',
      scope: 'chunk',
      transcript: 'My summary.'
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/materials/material_1/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkId: 'chunk_1', scope: 'chunk', transcript: 'My summary.' })
    });
    expect(result.score).toBe(88);
  });
});
