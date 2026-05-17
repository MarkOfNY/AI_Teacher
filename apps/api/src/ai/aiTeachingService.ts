import type { AiProvider, ReadingLevel } from '@ai-teacher/shared';
import { env } from '../config/env';
import { createAiRouter } from './aiRouter';
import { createDeepSeekClient } from './providers/deepSeekClient';
import { createOpenAiClient } from './providers/openAiClient';
import { createQwenClient } from './providers/qwenClient';

const router = createAiRouter({
  qwen: createQwenClient(env.QWEN_API_KEY),
  deepseek: createDeepSeekClient(env.DEEPSEEK_API_KEY),
  openai: createOpenAiClient(env.OPENAI_API_KEY)
});

export const aiTeachingService = {
  simplifyText(input: { provider: AiProvider; text: string; readingLevel: ReadingLevel; hint?: string; temperature?: number }) {
    return router.simplifyText(input);
  },

  explainContext(input: { provider: AiProvider; text: string }) {
    return router.explainContext(input);
  },

  explainGaps(input: { provider: AiProvider; text: string; missed: string[]; attempt?: number }) {
    return router.explainGaps(input);
  },

  defineVocabulary(input: { provider: AiProvider; term: string; contextText: string }) {
    return router.defineVocabulary(input);
  },

  suggestReadingPartCount(input: { provider: AiProvider; text: string }) {
    return router.suggestReadingPartCount(input);
  },

  scoreParaphrase(input: { provider: AiProvider; referenceText: string; transcript: string; threshold: number }) {
    return router.scoreParaphrase(input);
  },

  extractTextFromImage(input: { provider: AiProvider; imageBase64: string; mimeType: string }) {
    return router.extractTextFromImage(input);
  }
};
