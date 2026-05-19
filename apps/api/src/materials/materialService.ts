import type { AiProvider, ReadingLevel, ScoreResult } from '@ai-teacher/shared';
import type { AiErrorLogInput } from '../ai/aiErrorLogger';
import { logAiError } from '../ai/aiErrorLogger';
import { aiTeachingService } from '../ai/aiTeachingService';
import { prisma } from '../db/prisma';
import { determineChunkStatus, determineMaterialStatus } from '../lessons/lessonService';
import { normalizeScoreResult } from '../scoring/rubric';
import { chunkText } from './chunker';

function stripHtml(html: string): string {
  return html
    .replace(/<\/p>|<\/h[1-6]>|<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function words(value: string) {
  return Array.from(new Set(value.toLowerCase().match(/[a-z0-9']+/g) ?? [])).filter((word) => word.length > 3);
}

export function scoreParaphraseForText(reference: string, transcript: string, threshold: number) {
  const referenceWords = words(reference);
  const transcriptWords = words(transcript);
  const transcriptSet = new Set(transcriptWords);
  const understood = referenceWords.filter((word) => transcriptSet.has(word));
  const missed = referenceWords.filter((word) => !transcriptSet.has(word));
  const score = referenceWords.length === 0 ? 0 : Math.round((understood.length / referenceWords.length) * 100);

  return normalizeScoreResult({
    score,
    passed: false,
    rubric: {
      mainIdea: score,
      keyDetails: score,
      context: Math.min(100, score + 5),
      whyItMatters: Math.min(100, score + 5),
      accuracy: score
    },
    understood: understood.slice(0, 6),
    missed: missed.slice(0, 6),
    feedback: score >= threshold
      ? 'Good understanding. You covered the important ideas clearly enough to move on.'
      : `You are close, but add these important ideas: ${missed.slice(0, 6).join(', ') || 'more key details from the text'}.`
  }, threshold);
}

type ScoringProvider = 'qwen' | 'deepseek' | 'openai';

interface AiScoringService {
  scoreParaphrase(input: { provider: ScoringProvider; referenceText: string; transcript: string; threshold: number }): Promise<ScoreResult>;
}

interface AiChunkingService {
  suggestReadingPartCount(input: { provider: AiProvider; text: string }): Promise<number>;
}

export async function scoreParaphraseWithAi(input: {
  referenceText: string;
  transcript: string;
  threshold: number;
  provider?: ScoringProvider;
  fallbackProvider?: ScoringProvider;
  service?: AiScoringService;
  logError?: (input: AiErrorLogInput) => Promise<void> | void;
}) {
  const service = input.service ?? aiTeachingService;
  const logger = input.logError ?? logAiError;
  const provider = input.provider ?? 'qwen';
  const fallback = input.fallbackProvider ?? 'openai';

  try {
    return await service.scoreParaphrase({ provider, referenceText: input.referenceText, transcript: input.transcript, threshold: input.threshold });
  } catch (primaryError) {
    await logger({ task: 'scoring paraphrase', provider, error: primaryError });
    if (fallback === provider) throw primaryError;
    try {
      return await service.scoreParaphrase({ provider: fallback, referenceText: input.referenceText, transcript: input.transcript, threshold: input.threshold });
    } catch (fallbackError) {
      await logger({ task: 'scoring paraphrase', provider: fallback, error: fallbackError });
      throw fallbackError;
    }
  }
}

export async function suggestReadingPartCount(input: {
  text: string;
  provider?: AiProvider;
  service?: AiChunkingService;
}) {
  const deterministicCount = chunkText(input.text).length;
  const provider = input.provider ?? 'qwen';
  const service = input.service ?? aiTeachingService;

  try {
    const aiCount = await service.suggestReadingPartCount({ provider, text: input.text });
    if (Number.isFinite(aiCount) && aiCount > 0) {
      const cappedAiCount = Math.max(1, Math.min(Math.round(aiCount), Math.max(1, countSentencesForCap(input.text))));
      return Math.max(deterministicCount, cappedAiCount);
    }
  } catch {
    return deterministicCount;
  }

  return deterministicCount;
}

function countSentencesForCap(text: string) {
  return Math.max(1, text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.length ?? 1);
}

export const materialService = {
  async createMaterial(input: { userProfileId: string; title: string; originalText: string; readingPartCount?: number }) {
    const chunks = chunkText(stripHtml(input.originalText), { readingPartCount: input.readingPartCount });

    return prisma.material.create({
      data: {
        userProfileId: input.userProfileId,
        title: input.title,
        originalText: input.originalText,
        chunks: {
          create: chunks.map((chunk) => ({ index: chunk.index, text: chunk.text }))
        }
      },
      include: { chunks: { orderBy: { index: 'asc' } } }
    });
  },

  async listMaterials(userProfileId: string) {
    return prisma.material.findMany({
      where: { userProfileId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        finalBestScore: true
      }
    });
  },

  async getMaterial(materialId: string) {
    const raw = await prisma.material.findUnique({
      where: { id: materialId },
      include: { chunks: { orderBy: { index: 'asc' } } }
    });
    if (!raw) return null;
    return {
      ...raw,
      chunks: raw.chunks.map((chunk) => ({
        ...chunk,
        simplifications: JSON.parse(chunk.simplifications || '{}') as Partial<Record<ReadingLevel, string[]>>,
        contextExplanation: chunk.contextExplanation ?? null,
        keyTerms: JSON.parse(chunk.keyTermsJson || '[]') as Array<{ term: string; definition: string }>
      }))
    };
  },

  async updateMaterial(input: { materialId: string; title: string; originalText: string }) {
    const material = await prisma.material.findUnique({
      where: { id: input.materialId },
      include: { chunks: true }
    });

    if (!material) {
      throw new Error('Material not found');
    }

    const chunks = chunkText(stripHtml(input.originalText));
    await prisma.$transaction(async (transaction) => {
      await transaction.paraphraseAttempt.deleteMany({ where: { materialId: material.id } });
      await transaction.materialChunk.deleteMany({ where: { materialId: material.id } });
      await transaction.material.update({
        where: { id: material.id },
        data: {
          title: input.title,
          originalText: input.originalText,
          status: 'notStarted',
          finalBestScore: null,
          chunks: {
            create: chunks.map((chunk) => ({ index: chunk.index, text: chunk.text }))
          }
        }
      });
    });

    return prisma.material.findUniqueOrThrow({
      where: { id: material.id },
      include: { chunks: { orderBy: { index: 'asc' } } }
    });
  },

  async deleteMaterial(materialId: string) {
    await prisma.$transaction(async (transaction) => {
      await transaction.paraphraseAttempt.deleteMany({ where: { materialId } });
      await transaction.materialChunk.deleteMany({ where: { materialId } });
      await transaction.material.delete({ where: { id: materialId } });
    });
  },

  async updateReadingParts(input: { materialId: string; readingPartCount: number }) {
    const material = await prisma.material.findUnique({
      where: { id: input.materialId },
      include: { chunks: { orderBy: { index: 'asc' } } }
    });

    if (!material) {
      throw new Error('Material not found');
    }

    const nextChunks = chunkText(stripHtml(material.originalText), { readingPartCount: input.readingPartCount });
    const existingByIndex = new Map(material.chunks.map((chunk) => [chunk.index, chunk]));
    const nextIndexes = new Set(nextChunks.map((chunk) => chunk.index));
    const extraChunks = material.chunks.filter((chunk) => !nextIndexes.has(chunk.index));

    if (extraChunks.length > 0) {
      await prisma.paraphraseAttempt.updateMany({
        where: { chunkId: { in: extraChunks.map((chunk) => chunk.id) } },
        data: { chunkId: null }
      });
      await prisma.materialChunk.deleteMany({
        where: { id: { in: extraChunks.map((chunk) => chunk.id) } }
      });
    }

    for (const chunk of nextChunks) {
      const existing = existingByIndex.get(chunk.index);
      if (existing) {
        const textChanged = existing.text !== chunk.text;
        await prisma.materialChunk.update({
          where: { id: existing.id },
          data: {
            text: chunk.text,
            status: 'notStarted',
            bestScore: null,
            ...(textChanged ? { simplifications: '{}', contextExplanation: null } : {})
          }
        });
      } else {
        await prisma.materialChunk.create({
          data: { materialId: material.id, index: chunk.index, text: chunk.text }
        });
      }
    }

    await prisma.material.update({
      where: { id: material.id },
      data: { status: 'notStarted', finalBestScore: null }
    });

    const raw = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
      include: { chunks: { orderBy: { index: 'asc' } } }
    });
    return {
      ...raw,
      chunks: raw.chunks.map((chunk) => ({
        ...chunk,
        simplifications: JSON.parse(chunk.simplifications || '{}') as Partial<Record<ReadingLevel, string[]>>,
        contextExplanation: chunk.contextExplanation ?? null
      }))
    };
  },

  async generateSimplifications(input: { materialId: string; readingLevel: Exclude<ReadingLevel, 'original'>; provider?: AiProvider }) {
    const material = await prisma.material.findUnique({
      where: { id: input.materialId },
      include: { chunks: { orderBy: { index: 'asc' } } }
    });
    if (!material) throw new Error('Material not found');

    const provider = input.provider ?? 'qwen';
    const TARGET = 5;
    const MAX_TRIES = 4;
    const THRESHOLD = 90;

    for (const chunk of material.chunks) {
      const stored = JSON.parse(chunk.simplifications || '{}') as Partial<Record<ReadingLevel, string[]>>;
      const existing = stored[input.readingLevel] ?? [];
      if (existing.length >= TARGET) continue;

      const versions = [...existing];
      while (versions.length < TARGET) {
        let best = '';
        let bestScore = -1;
        for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
          let text: string;
          try {
            text = await aiTeachingService.simplifyText({ provider, text: chunk.text, readingLevel: input.readingLevel });
          } catch {
            break;
          }
          try {
            const result = await aiTeachingService.scoreParaphrase({ provider, referenceText: chunk.text, transcript: text, threshold: THRESHOLD });
            if (result.score >= THRESHOLD) { best = text; break; }
            if (result.score > bestScore) { bestScore = result.score; best = text; }
          } catch {
            if (!best) best = text;
            break;
          }
        }
        if (best) versions.push(best);
        else break;
      }

      if (versions.length > existing.length) {
        await prisma.materialChunk.update({
          where: { id: chunk.id },
          data: { simplifications: JSON.stringify({ ...stored, [input.readingLevel]: versions }) }
        });
      }
    }

    const refreshed = await prisma.material.findUniqueOrThrow({
      where: { id: input.materialId },
      include: { chunks: { orderBy: { index: 'asc' } } }
    });
    return {
      ...refreshed,
      chunks: refreshed.chunks.map((chunk) => ({
        ...chunk,
        simplifications: JSON.parse(chunk.simplifications || '{}') as Partial<Record<ReadingLevel, string[]>>,
        contextExplanation: chunk.contextExplanation ?? null
      }))
    };
  },

  async generateChunkSimplifications(input: { chunkId: string; materialId: string; readingLevel: Exclude<ReadingLevel, 'original'>; provider?: AiProvider }) {
    const chunk = await prisma.materialChunk.findFirst({
      where: { id: input.chunkId, materialId: input.materialId }
    });
    if (!chunk) throw new Error('Chunk not found');

    const stored = JSON.parse(chunk.simplifications || '{}') as Partial<Record<ReadingLevel, string[]>>;
    const existing = stored[input.readingLevel] ?? [];
    const needed = Math.max(0, 5 - existing.length);
    if (needed === 0) return { id: chunk.id, simplifications: stored };

    const provider = input.provider ?? 'qwen';
    const THRESHOLD = 90;
    const VERSION_CONFIGS = [
      { hint: 'Cover all key ideas from the original.', temperature: 0.4 },
      { hint: 'Use very short sentences. One idea per sentence. Cover all key ideas.', temperature: 0.55 },
      { hint: 'Lead with the most important point, then each supporting detail. Cover all key ideas.', temperature: 0.6 },
      { hint: 'Explain conversationally, as if to a friend. Cover all key ideas from the original.', temperature: 0.65 },
      { hint: 'Organize around what happened, why it happened, and why it matters. Cover all key ideas.', temperature: 0.7 }
    ] as const;

    const candidates = await Promise.all(
      Array.from({ length: needed }, (_, i) => {
        const { hint, temperature } = VERSION_CONFIGS[(existing.length + i) % VERSION_CONFIGS.length];
        return aiTeachingService.simplifyText({ provider, text: chunk.text, readingLevel: input.readingLevel, hint, temperature }).catch(() => null);
      })
    );

    const validCandidates = candidates.filter((v): v is string => v !== null);

    const scored = await Promise.all(
      validCandidates.map(async (text) => {
        try {
          const result = await aiTeachingService.scoreParaphrase({ provider, referenceText: chunk.text, transcript: text, threshold: THRESHOLD });
          return { text, score: result.score };
        } catch {
          return { text, score: THRESHOLD };
        }
      })
    );

    const passing = scored.filter((s) => s.score >= THRESHOLD).map((s) => s.text);
    const versions = [...existing, ...passing];
    const updated = { ...stored, [input.readingLevel]: versions };

    await prisma.materialChunk.update({
      where: { id: chunk.id },
      data: { simplifications: JSON.stringify(updated) }
    });

    return { id: chunk.id, simplifications: updated };
  },

  async saveContextExplanation(input: { chunkId: string; materialId: string; explanation: string }) {
    await prisma.materialChunk.updateMany({
      where: { id: input.chunkId, materialId: input.materialId },
      data: { contextExplanation: input.explanation }
    });
  },

  async generateKeyTerms(input: { chunkId: string; materialId: string; text?: string; provider?: AiProvider; force?: boolean }) {
    const chunk = await prisma.materialChunk.findFirst({
      where: { id: input.chunkId, materialId: input.materialId }
    });
    if (!chunk) throw new Error('Chunk not found');

    const textToUse = input.text ?? chunk.text;
    const existing = JSON.parse(chunk.keyTermsJson || '[]') as Array<{ term: string; definition: string }>;
    if (existing.length > 0 && !input.force && !input.text) return { id: chunk.id, keyTerms: existing };

    const provider = input.provider ?? 'qwen';
    const raw = await aiTeachingService.extractKeyTerms({ provider, text: textToUse });

    let keyTerms: Array<{ term: string; definition: string }> = [];
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      keyTerms = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as Array<{ term: string; definition: string }>;
    } catch {
      keyTerms = [];
    }

    await prisma.materialChunk.updateMany({
      where: { id: input.chunkId, materialId: input.materialId },
      data: { keyTermsJson: JSON.stringify(keyTerms) }
    });

    return { id: chunk.id, keyTerms };
  },

  async suggestReadingParts(materialId: string, provider: AiProvider = 'qwen') {
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) {
      throw new Error('Material not found');
    }

    return { readingPartCount: await suggestReadingPartCount({ text: stripHtml(material.originalText), provider }) };
  },

  async submitParaphraseAttempt(input: { materialId: string; scope: 'chunk' | 'final'; chunkId?: string; transcript: string; referenceText?: string }) {
    const material = await prisma.material.findUnique({
      where: { id: input.materialId },
      include: {
        chunks: { orderBy: { index: 'asc' } },
        userProfile: { include: { routingPreferences: true } }
      }
    });

    if (!material) {
      throw new Error('Material not found');
    }

    const chunk = input.scope === 'chunk'
      ? material.chunks.find((candidate) => candidate.id === input.chunkId)
      : null;

    if (input.scope === 'chunk' && !chunk) {
      throw new Error('Chunk not found');
    }

    const threshold = input.scope === 'chunk'
      ? material.userProfile.chunkMasteryThreshold
      : material.userProfile.finalSummaryMasteryThreshold;
    const referenceText = input.referenceText ?? chunk?.text ?? stripHtml(material.originalText);

    const scoringCapability = input.scope === 'chunk' ? 'scoreChunkParaphrase' : 'scoreFinalSummary';
    const routingPref = material.userProfile.routingPreferences.find((p) => p.capability === scoringCapability);
    const fallbackPref = material.userProfile.routingPreferences.find((p) => p.capability === 'fallback');
    const SCORING_PROVIDERS: ScoringProvider[] = ['qwen', 'deepseek', 'openai'];
    const scoringProvider: ScoringProvider = SCORING_PROVIDERS.includes(routingPref?.provider as ScoringProvider)
      ? routingPref!.provider as ScoringProvider
      : 'qwen';
    const fallbackProvider: ScoringProvider = SCORING_PROVIDERS.includes(fallbackPref?.provider as ScoringProvider)
      ? fallbackPref!.provider as ScoringProvider
      : 'openai';

    const result = await scoreParaphraseWithAi({
      referenceText,
      transcript: input.transcript,
      threshold,
      provider: scoringProvider,
      fallbackProvider
    });

    await prisma.paraphraseAttempt.create({
      data: {
        materialId: input.materialId,
        chunkId: chunk?.id,
        scope: input.scope,
        transcript: input.transcript,
        score: result.score,
        passed: result.passed,
        rubricJson: JSON.stringify(result.rubric),
        feedback: result.feedback
      }
    });

    if (chunk) {
      await prisma.materialChunk.update({
        where: { id: chunk.id },
        data: {
          bestScore: Math.max(chunk.bestScore ?? 0, result.score),
          status: determineChunkStatus(Math.max(chunk.bestScore ?? 0, result.score), threshold)
        }
      });
    } else {
      await prisma.material.update({
        where: { id: material.id },
        data: { finalBestScore: Math.max(material.finalBestScore ?? 0, result.score) }
      });
    }

    const refreshed = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
      include: { chunks: true }
    });
    const nextStatus = determineMaterialStatus({
      chunkStatuses: refreshed.chunks.map((candidate) => candidate.status as 'notStarted' | 'inProgress' | 'mastered'),
      finalScore: refreshed.finalBestScore,
      finalThreshold: material.userProfile.finalSummaryMasteryThreshold
    });
    await prisma.material.update({ where: { id: material.id }, data: { status: nextStatus } });

    return result;
  }
};
