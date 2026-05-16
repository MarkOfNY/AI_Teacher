import type { ScoreResult } from '@ai-teacher/shared';

export function passedThreshold(score: number, threshold: number): boolean {
  return score >= threshold;
}

export function normalizeScoreResult(result: ScoreResult, threshold: number): ScoreResult {
  const score = Math.max(0, Math.min(100, Math.round(result.score)));
  return {
    ...result,
    score,
    passed: passedThreshold(score, threshold)
  };
}
