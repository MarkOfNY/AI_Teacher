import { describe, expect, it } from 'vitest';
import { determineChunkStatus, determineMaterialStatus } from './lessonService';

describe('lesson completion rules', () => {
  it('marks a chunk mastered when score meets chunk threshold', () => {
    expect(determineChunkStatus(90, 90)).toBe('mastered');
    expect(determineChunkStatus(89, 90)).toBe('inProgress');
  });

  it('requires every chunk and final summary to complete material', () => {
    expect(determineMaterialStatus({ chunkStatuses: ['mastered', 'mastered'], finalScore: 90, finalThreshold: 90 }))
      .toBe('complete');
    expect(determineMaterialStatus({ chunkStatuses: ['mastered', 'inProgress'], finalScore: 95, finalThreshold: 90 }))
      .toBe('inProgress');
    expect(determineMaterialStatus({ chunkStatuses: ['mastered'], finalScore: 89, finalThreshold: 90 }))
      .toBe('inProgress');
  });
});
