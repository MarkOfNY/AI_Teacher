import { describe, expect, it, vi } from 'vitest';
import { createDeepSeekClient } from './deepSeekClient';

describe('score paraphrase prompt', () => {
  it('does not penalize accurate extra context from app explanations', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 95,
                rubric: { mainIdea: 95, keyDetails: 95, context: 95, whyItMatters: 95, accuracy: 95 },
                understood: ['core idea'],
                missed: [],
                feedback: 'Good.'
              })
            }
          }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    await createDeepSeekClient('key').scoreParaphrase({
      referenceText: 'The colonies said they could change a bad government.',
      transcript: 'The colonies were ruled by Britain, and they said people can leave a bad government.',
      threshold: 90
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const prompt = body.messages[1].content as string;
    expect(prompt).toContain('Do not penalize accurate extra background or context');
    expect(prompt).toContain('app explanation');

    vi.unstubAllGlobals();
  });
});
