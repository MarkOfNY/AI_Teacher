import { describe, expect, it, vi } from 'vitest';
import { scoreParaphraseForText, scoreParaphraseWithAi, suggestReadingPartCount } from './materialService';

describe('scoreParaphraseForText', () => {
  it('scores against all matched ideas instead of a display-limited subset', () => {
    const result = scoreParaphraseForText(
      'American colonists protested British taxes by dumping tea into Boston Harbor and moved closer to revolution.',
      'American colonists protested British taxes by dumping tea into Boston Harbor and moved closer to revolution.',
      90
    );

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });
});

describe('scoreParaphraseWithAi', () => {
  it('can pass simplified wording when the AI scorer says the core ideas are present', async () => {
    const result = await scoreParaphraseWithAi({
      referenceText: 'The Stamp Act made colonists pay taxes on printed paper and increased anger at British rule.',
      transcript: 'Colonists had to pay a tax on paper, and that made them angrier at Britain.',
      threshold: 90,
      service: {
        scoreParaphrase: async () => ({
          score: 92,
          passed: true,
          rubric: { mainIdea: 92, keyDetails: 90, context: 90, whyItMatters: 92, accuracy: 94 },
          understood: ['tax on paper', 'anger at Britain'],
          missed: [],
          feedback: 'The paraphrase uses simpler wording but keeps the core ideas.'
        })
      }
    });

    expect(result.score).toBe(92);
    expect(result.passed).toBe(true);
  });

  it('logs provider failures before surfacing an AI scoring error', async () => {
    const logError = vi.fn();
    const qwenError = new Error('Qwen quota problem');
    const openAiError = new Error('OpenAI quota problem');

    await expect(scoreParaphraseWithAi({
      referenceText: 'Original reading part.',
      transcript: 'Student paraphrase.',
      threshold: 90,
      logError,
      service: {
        scoreParaphrase: async (input) => {
          if (input.provider === 'qwen') throw qwenError;
          throw openAiError;
        }
      }
    })).rejects.toThrow(openAiError);

    expect(logError).toHaveBeenNthCalledWith(1, {
      task: 'scoring paraphrase',
      provider: 'qwen',
      error: qwenError
    });
    expect(logError).toHaveBeenNthCalledWith(2, {
      task: 'scoring paraphrase',
      provider: 'openai',
      error: openAiError
    });
  });
});

describe('suggestReadingPartCount', () => {
  it('uses Qwen by default before falling back to deterministic chunking', async () => {
    const service = {
      suggestReadingPartCount: vi.fn().mockResolvedValue(5)
    };

    const result = await suggestReadingPartCount({
      text: 'One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten.',
      service
    });

    expect(result).toBe(5);
    expect(service.suggestReadingPartCount).toHaveBeenCalledWith({
      provider: 'qwen',
      text: 'One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten.'
    });
  });

  it('does not accept an AI suggestion that would create oversized reading parts', async () => {
    const service = {
      suggestReadingPartCount: vi.fn().mockResolvedValue(2)
    };
    const text = Array.from({ length: 80 }, (_unused, index) => `Sentence ${index + 1} explains an important connected idea.`).join(' ');

    const result = await suggestReadingPartCount({ text, service });

    expect(result).toBeGreaterThan(2);
  });
});
