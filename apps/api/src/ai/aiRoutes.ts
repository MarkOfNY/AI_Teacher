import type { AiProvider, ReadingLevel } from '@ai-teacher/shared';
import { Router } from 'express';
import { z } from 'zod';
import { logAiError } from './aiErrorLogger';
import { aiTeachingService } from './aiTeachingService';
import { AiProviderError } from './providers/providerErrors';

const ProviderSchema = z.enum(['qwen', 'deepseek', 'openai', 'browserTts', 'disabled']).default('qwen');

const SimplifySchema = z.object({
  text: z.string().min(1),
  readingLevel: z.enum(['verySimple', 'simple', 'middleSchool', 'original']).default('simple'),
  provider: ProviderSchema
});

const ExplainContextSchema = z.object({
  text: z.string().min(1),
  provider: ProviderSchema
});

const ExplainGapsSchema = z.object({
  text: z.string().min(1),
  missed: z.array(z.string()).default([]),
  attempt: z.number().int().min(1).optional(),
  provider: ProviderSchema
});

const DefineVocabularySchema = z.object({
  term: z.string().min(1),
  contextText: z.string().min(1),
  provider: ProviderSchema
});

export interface AiTeachingServiceLike {
  simplifyText(input: { provider: AiProvider; text: string; readingLevel: ReadingLevel }): Promise<string>;
  explainContext(input: { provider: AiProvider; text: string }): Promise<string>;
  explainGaps(input: { provider: AiProvider; text: string; missed: string[]; attempt?: number }): Promise<string>;
  defineVocabulary(input: { provider: AiProvider; term: string; contextText: string }): Promise<string>;
}

function providerLabel(provider: AiProvider) {
  if (provider === 'qwen') return 'Qwen';
  if (provider === 'deepseek') return 'DeepSeek';
  if (provider === 'openai') return 'OpenAI';
  return provider;
}

function publicErrorDetail(error: unknown) {
  if (error instanceof AiProviderError && error.providerMessage) {
    return error.providerMessage;
  }

  return null;
}

async function sendAiFailure(res: { status: (status: number) => { json: (body: unknown) => void } }, input: {
  task: string;
  provider: AiProvider;
  error: unknown;
}) {
  await logAiError(input);
  const detail = publicErrorDetail(input.error);
  res.status(502).json({
    error: `The app is having difficulty completing ${input.task} with ${providerLabel(input.provider)}.${detail ? ` ${detail}` : ''}`,
    task: input.task,
    provider: input.provider
  });
}

export function createAiRouterRoutes(service: AiTeachingServiceLike = aiTeachingService) {
  const router = Router();

  router.post('/simplify', async (req, res, next) => {
    try {
      const parsed = SimplifySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid simplify input' });
        return;
      }

      const text = await service.simplifyText(parsed.data);
      res.json({ text, provider: parsed.data.provider });
    } catch (error) {
      const parsed = SimplifySchema.safeParse(req.body);
      if (parsed.success) {
        await sendAiFailure(res, { task: 'simplifying this text', provider: parsed.data.provider, error });
        return;
      }
      next(error);
    }
  });

  router.post('/explain-context', async (req, res, next) => {
    try {
      const parsed = ExplainContextSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid context input' });
        return;
      }

      const explanation = await service.explainContext(parsed.data);
      res.json({ explanation, provider: parsed.data.provider });
    } catch (error) {
      const parsed = ExplainContextSchema.safeParse(req.body);
      if (parsed.success) {
        await sendAiFailure(res, { task: 'explaining context', provider: parsed.data.provider, error });
        return;
      }
      next(error);
    }
  });

  router.post('/explain-gaps', async (req, res, next) => {
    try {
      const parsed = ExplainGapsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid gap explanation input' });
        return;
      }

      const explanation = await service.explainGaps(parsed.data);
      res.json({ explanation, provider: parsed.data.provider });
    } catch (error) {
      const parsed = ExplainGapsSchema.safeParse(req.body);
      if (parsed.success) {
        await sendAiFailure(res, { task: 'explaining missed ideas', provider: parsed.data.provider, error });
        return;
      }
      next(error);
    }
  });

  router.post('/define', async (req, res, next) => {
    try {
      const parsed = DefineVocabularySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid vocabulary definition input' });
        return;
      }

      const definition = await service.defineVocabulary(parsed.data);
      res.json({ definition, provider: parsed.data.provider });
    } catch (error) {
      const parsed = DefineVocabularySchema.safeParse(req.body);
      if (parsed.success) {
        await sendAiFailure(res, { task: 'defining vocabulary', provider: parsed.data.provider, error });
        return;
      }
      next(error);
    }
  });

  return router;
}
