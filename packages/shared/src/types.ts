import type { AiRoutingPreferences } from './aiCapabilities';

export type UserRole = 'student' | 'parent';
export type ReadingLevel = 'verySimple' | 'simple' | 'middleSchool' | 'original';

export interface MasterySettings {
  chunkMasteryThreshold: number;
  finalSummaryMasteryThreshold: number;
}

export interface StudentProfile {
  id: string;
  displayName: string;
  preferredReadingLevel: ReadingLevel;
  masterySettings: MasterySettings;
  aiRoutingPreferences: AiRoutingPreferences;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface MaterialChunk {
  id: string;
  materialId: string;
  index: number;
  text: string;
  status: 'notStarted' | 'inProgress' | 'mastered';
  bestScore: number | null;
  simplifications?: Partial<Record<ReadingLevel, string[]>>;
  contextExplanation?: string | null;
  keyTerms?: KeyTerm[];
}

export interface ScoreRubric {
  mainIdea: number;
  keyDetails: number;
  context: number;
  whyItMatters: number;
  accuracy: number;
}

export interface ScoreResult {
  score: number;
  passed: boolean;
  rubric: ScoreRubric;
  understood: string[];
  missed: string[];
  feedback: string;
}
