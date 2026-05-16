import { describe, expect, it } from 'vitest';
import { AI_CAPABILITIES, isAiCapability } from './aiCapabilities';

describe('AI_CAPABILITIES', () => {
  it('contains the required MVP routing capabilities', () => {
    expect(AI_CAPABILITIES).toEqual([
      'simplifyText',
      'explainContext',
      'defineVocabulary',
      'explainWhyItMatters',
      'scoreChunkParaphrase',
      'generateGapAwareExplanation',
      'scoreFinalSummary',
      'transcribeSpeech',
      'generateSpeech',
      'extractTextFromImage',
      'fallback'
    ]);
  });

  it('validates capability names', () => {
    expect(isAiCapability('simplifyText')).toBe(true);
    expect(isAiCapability('chat')).toBe(false);
  });
});
