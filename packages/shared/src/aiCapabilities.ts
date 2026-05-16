export const AI_CAPABILITIES = [
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
] as const;

export type AiCapability = (typeof AI_CAPABILITIES)[number];

export const AI_PROVIDERS = ['qwen', 'deepseek', 'openai', 'browserTts', 'disabled'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type AiRoutingPreferences = Record<AiCapability, AiProvider>;

export function isAiCapability(value: string): value is AiCapability {
  return AI_CAPABILITIES.includes(value as AiCapability);
}

export const DEFAULT_ROUTING_PREFERENCES: AiRoutingPreferences = {
  simplifyText: 'qwen',
  explainContext: 'qwen',
  defineVocabulary: 'qwen',
  explainWhyItMatters: 'qwen',
  scoreChunkParaphrase: 'qwen',
  generateGapAwareExplanation: 'qwen',
  scoreFinalSummary: 'qwen',
  transcribeSpeech: 'qwen',
  generateSpeech: 'qwen',
  extractTextFromImage: 'qwen',
  fallback: 'openai'
};
