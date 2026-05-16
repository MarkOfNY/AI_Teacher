import { describe, expect, it, vi } from 'vitest';
import { createAiRouter } from './aiRouter';

describe('createAiRouter', () => {
  it('routes selected capability to DeepSeek', async () => {
    const deepseek = { simplifyText: vi.fn().mockResolvedValue('simple') };
    const openai = { simplifyText: vi.fn().mockResolvedValue('openai simple') };
    const router = createAiRouter({ qwen: {}, deepseek, openai });

    const result = await router.simplifyText({
      provider: 'deepseek',
      text: 'complex',
      readingLevel: 'simple'
    });

    expect(result).toBe('simple');
    expect(deepseek.simplifyText).toHaveBeenCalledOnce();
    expect(openai.simplifyText).not.toHaveBeenCalled();
  });

  it('routes selected capability to OpenAI', async () => {
    const deepseek = { simplifyText: vi.fn().mockResolvedValue('simple') };
    const openai = { simplifyText: vi.fn().mockResolvedValue('openai simple') };
    const router = createAiRouter({ qwen: {}, deepseek, openai });

    const result = await router.simplifyText({
      provider: 'openai',
      text: 'complex',
      readingLevel: 'simple'
    });

    expect(result).toBe('openai simple');
    expect(openai.simplifyText).toHaveBeenCalledOnce();
    expect(deepseek.simplifyText).not.toHaveBeenCalled();
  });

  it('throws when provider is disabled', async () => {
    const router = createAiRouter({ qwen: {}, deepseek: {}, openai: {} });
    await expect(router.simplifyText({ provider: 'disabled', text: 'x', readingLevel: 'simple' }))
      .rejects.toThrow('Capability simplifyText is disabled');
  });

  it('rejects browserTts for backend-only work', async () => {
    const router = createAiRouter({ qwen: {}, deepseek: {}, openai: {} });
    await expect(router.simplifyText({ provider: 'browserTts', text: 'x', readingLevel: 'simple' }))
      .rejects.toThrow('Capability simplifyText cannot run on backend browserTts');
  });

  it('routes paraphrase scoring to the selected provider', async () => {
    const deepseek = {
      scoreParaphrase: vi.fn().mockResolvedValue({
        score: 95,
        passed: true,
        rubric: { mainIdea: 95, keyDetails: 95, context: 95, whyItMatters: 95, accuracy: 95 },
        understood: ['main idea'],
        missed: [],
        feedback: 'The simplified wording keeps the core ideas.'
      })
    };
    const openai = { scoreParaphrase: vi.fn() };
    const router = createAiRouter({ qwen: {}, deepseek, openai });

    const result = await router.scoreParaphrase({
      provider: 'deepseek',
      referenceText: 'The colonists protested the tax.',
      transcript: 'People objected to paying the tax.',
      threshold: 90
    });

    expect(result.passed).toBe(true);
    expect(deepseek.scoreParaphrase).toHaveBeenCalledOnce();
    expect(openai.scoreParaphrase).not.toHaveBeenCalled();
  });

  it('routes vocabulary definition to the selected provider', async () => {
    const deepseek = {
      defineVocabulary: vi.fn().mockResolvedValue('Liberty means freedom.')
    };
    const openai = { defineVocabulary: vi.fn() };
    const router = createAiRouter({ qwen: {}, deepseek, openai });

    const result = await router.defineVocabulary({
      provider: 'deepseek',
      term: 'liberty',
      contextText: 'The text says people have liberty.'
    });

    expect(result).toBe('Liberty means freedom.');
    expect(deepseek.defineVocabulary).toHaveBeenCalledWith({
      term: 'liberty',
      contextText: 'The text says people have liberty.'
    });
    expect(openai.defineVocabulary).not.toHaveBeenCalled();
  });
});
