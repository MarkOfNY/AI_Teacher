import type { AiProvider, ReadingLevel, ScoreResult } from '@ai-teacher/shared';

interface SimplifyInput {
  provider: AiProvider;
  text: string;
  readingLevel: ReadingLevel;
  hint?: string;
  temperature?: number;
}

interface ProviderClient {
  simplifyText?(input: { text: string; readingLevel: ReadingLevel; hint?: string; temperature?: number }): Promise<string>;
  explainContext?(input: { text: string }): Promise<string>;
  explainGaps?(input: { text: string; missed: string[]; attempt?: number }): Promise<string>;
  defineVocabulary?(input: { term: string; contextText: string }): Promise<string>;
  suggestReadingPartCount?(input: { text: string }): Promise<number>;
  scoreParaphrase?(input: { referenceText: string; transcript: string; threshold: number }): Promise<ScoreResult>;
  extractTextFromImage?(input: { imageBase64: string; mimeType: string }): Promise<string>;
  structureTextAsHtml?(input: { text: string }): Promise<string>;
}

export function createAiRouter(clients: { qwen: ProviderClient; deepseek: ProviderClient; openai: ProviderClient }) {
  function clientFor(provider: AiProvider, capability: string): ProviderClient {
    if (provider === 'disabled') throw new Error(`Capability ${capability} is disabled`);
    if (provider === 'browserTts') throw new Error(`Capability ${capability} cannot run on backend browserTts`);
    if (provider === 'openai') return clients.openai;
    if (provider === 'deepseek') return clients.deepseek;
    return clients.qwen;
  }

  return {
    async simplifyText(input: SimplifyInput) {
      const client = clientFor(input.provider, 'simplifyText');
      if (!client.simplifyText) throw new Error(`Provider ${input.provider} does not support simplifyText`);
      return client.simplifyText({ text: input.text, readingLevel: input.readingLevel, hint: input.hint, temperature: input.temperature });
    },
    async explainContext(input: { provider: AiProvider; text: string }) {
      const client = clientFor(input.provider, 'explainContext');
      if (!client.explainContext) throw new Error(`Provider ${input.provider} does not support explainContext`);
      return client.explainContext({ text: input.text });
    },
    async explainGaps(input: { provider: AiProvider; text: string; missed: string[]; attempt?: number }) {
      const client = clientFor(input.provider, 'explainGaps');
      if (!client.explainGaps) throw new Error(`Provider ${input.provider} does not support explainGaps`);
      return client.explainGaps({ text: input.text, missed: input.missed, attempt: input.attempt });
    },
    async defineVocabulary(input: { provider: AiProvider; term: string; contextText: string }) {
      const client = clientFor(input.provider, 'defineVocabulary');
      if (!client.defineVocabulary) throw new Error(`Provider ${input.provider} does not support defineVocabulary`);
      return client.defineVocabulary({ term: input.term, contextText: input.contextText });
    },
    async suggestReadingPartCount(input: { provider: AiProvider; text: string }) {
      const client = clientFor(input.provider, 'suggestReadingPartCount');
      if (!client.suggestReadingPartCount) throw new Error(`Provider ${input.provider} does not support suggestReadingPartCount`);
      return client.suggestReadingPartCount({ text: input.text });
    },
    async scoreParaphrase(input: { provider: AiProvider; referenceText: string; transcript: string; threshold: number }) {
      const client = clientFor(input.provider, 'scoreParaphrase');
      if (!client.scoreParaphrase) throw new Error(`Provider ${input.provider} does not support scoreParaphrase`);
      return client.scoreParaphrase({
        referenceText: input.referenceText,
        transcript: input.transcript,
        threshold: input.threshold
      });
    },
    async extractTextFromImage(input: { provider: AiProvider; imageBase64: string; mimeType: string }) {
      const client = clientFor(input.provider, 'extractTextFromImage');
      if (!client.extractTextFromImage) throw new Error(`Provider ${input.provider} does not support extractTextFromImage`);
      return client.extractTextFromImage({ imageBase64: input.imageBase64, mimeType: input.mimeType });
    },
    async structureTextAsHtml(input: { provider: AiProvider; text: string }) {
      const client = clientFor(input.provider, 'structureTextAsHtml');
      if (!client.structureTextAsHtml) throw new Error(`Provider ${input.provider} does not support structureTextAsHtml`);
      return client.structureTextAsHtml({ text: input.text });
    }
  };
}
