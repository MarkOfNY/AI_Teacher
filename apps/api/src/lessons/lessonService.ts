export type ChunkStatus = 'notStarted' | 'inProgress' | 'mastered';
export type MaterialStatus = 'notStarted' | 'inProgress' | 'complete';

export function determineChunkStatus(score: number, threshold: number): ChunkStatus {
  return score >= threshold ? 'mastered' : 'inProgress';
}

export function determineMaterialStatus(input: {
  chunkStatuses: ChunkStatus[];
  finalScore: number | null;
  finalThreshold: number;
}): MaterialStatus {
  if (input.chunkStatuses.length === 0) return 'notStarted';
  const allChunksMastered = input.chunkStatuses.every((status) => status === 'mastered');
  const finalPassed = input.finalScore !== null && input.finalScore >= input.finalThreshold;
  return allChunksMastered && finalPassed ? 'complete' : 'inProgress';
}
