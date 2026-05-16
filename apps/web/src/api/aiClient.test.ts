import { afterEach, describe, expect, it, vi } from 'vitest';
import { explainContext, explainGaps, simplifyText } from './aiClient';

describe('aiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests a simplified version of text', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'Simple text.' }) });
    vi.stubGlobal('fetch', fetch);

    const result = await simplifyText({ text: 'Hard text.', readingLevel: 'simple', provider: 'deepseek' });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/ai/simplify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hard text.', readingLevel: 'simple', provider: 'deepseek' })
    });
    expect(result.text).toBe('Simple text.');
  });

  it('requests context for selected text', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ explanation: 'Context.' }) });
    vi.stubGlobal('fetch', fetch);

    const result = await explainContext({ text: 'Event.', provider: 'deepseek' });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/ai/explain-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Event.', provider: 'deepseek' })
    });
    expect(result.explanation).toBe('Context.');
  });

  it('requests a gap-aware explanation after a failed score', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ explanation: 'Try this part again.' }) });
    vi.stubGlobal('fetch', fetch);

    const result = await explainGaps({ text: 'Chunk.', missed: ['cause'], provider: 'deepseek' });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/ai/explain-gaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Chunk.', missed: ['cause'], provider: 'deepseek' })
    });
    expect(result.explanation).toContain('again');
  });

  it('surfaces the API task-specific AI error message', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'The app is having difficulty completing simplifying this text with DeepSeek.' })
    });
    vi.stubGlobal('fetch', fetch);

    await expect(simplifyText({ text: 'Hard text.', readingLevel: 'simple', provider: 'deepseek' }))
      .rejects.toThrow('The app is having difficulty completing simplifying this text with DeepSeek.');
  });
});
