import type { AiProvider, ReadingLevel, ScoreResult } from '@ai-teacher/shared';
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
  readingLevel: z.string().optional(),
  provider: ProviderSchema
});

const GradeFrameSchema = z.object({
  frame: z.string().min(1),
  completion: z.string().min(1),
  passageText: z.string().min(1),
  provider: ProviderSchema
});

const GenerateSentenceFramesSchema = z.object({
  text: z.string().min(1),
  missed: z.array(z.string()).default([]),
  studentTranscript: z.string().default(''),
  provider: ProviderSchema
});

export interface AiTeachingServiceLike {
  simplifyText(input: { provider: AiProvider; text: string; readingLevel: ReadingLevel }): Promise<string>;
  explainContext(input: { provider: AiProvider; text: string }): Promise<string>;
  explainGaps(input: { provider: AiProvider; text: string; missed: string[]; attempt?: number }): Promise<string>;
  defineVocabulary(input: { provider: AiProvider; term: string; contextText: string; readingLevel?: string }): Promise<string>;
  gradeFrameCompletion(input: { provider: AiProvider; frame: string; completion: string; passageText: string }): Promise<{ passed: boolean; feedback: string }>;
  generateSentenceFrames(input: { provider: AiProvider; text: string; missed: string[]; studentTranscript: string }): Promise<string>;
  scoreParaphrase(input: { provider: AiProvider; referenceText: string; transcript: string; threshold: number }): Promise<ScoreResult>;
}

const EXPLAIN_PASS_THRESHOLD = 90;
const EXPLAIN_MAX_ATTEMPTS = 3;

async function verifyExplanation(
  generate: () => Promise<string>,
  referenceText: string,
  provider: AiProvider,
  service: AiTeachingServiceLike
): Promise<string> {
  let bestText = '';
  let bestScore = -1;
  for (let attempt = 0; attempt < EXPLAIN_MAX_ATTEMPTS; attempt++) {
    const explanation = await generate();
    try {
      const result = await service.scoreParaphrase({ provider, referenceText, transcript: explanation, threshold: EXPLAIN_PASS_THRESHOLD });
      if (result.score >= EXPLAIN_PASS_THRESHOLD) return explanation;
      if (result.score > bestScore) { bestScore = result.score; bestText = explanation; }
    } catch {
      return explanation;
    }
  }
  return bestText;
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

      const explanation = await verifyExplanation(
        () => service.explainContext(parsed.data),
        parsed.data.text,
        parsed.data.provider,
        service
      );
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

      const explanation = await verifyExplanation(
        () => service.explainGaps(parsed.data),
        parsed.data.text,
        parsed.data.provider,
        service
      );
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

  router.post('/grade-frame', async (req, res, next) => {
    try {
      const parsed = GradeFrameSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid frame grading input' });
        return;
      }
      const result = await service.gradeFrameCompletion(parsed.data);
      res.json({ ...result, provider: parsed.data.provider });
    } catch (error) {
      const parsed = GradeFrameSchema.safeParse(req.body);
      if (parsed.success) {
        await sendAiFailure(res, { task: 'grading frame completion', provider: parsed.data.provider, error });
        return;
      }
      next(error);
    }
  });

  router.post('/generate-sentence-frames', async (req, res, next) => {
    try {
      const parsed = GenerateSentenceFramesSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid sentence frames input' });
        return;
      }

      const raw = await service.generateSentenceFrames(parsed.data);
      let frames: Array<{ frame: string; hint: string }> = [];
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        frames = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as Array<{ frame: string; hint: string }>;
      } catch {
        frames = [];
      }
      res.json({ frames, provider: parsed.data.provider });
    } catch (error) {
      const parsed = GenerateSentenceFramesSchema.safeParse(req.body);
      if (parsed.success) {
        await sendAiFailure(res, { task: 'generating sentence frames', provider: parsed.data.provider, error });
        return;
      }
      next(error);
    }
  });

  return router;
}
