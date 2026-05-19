import type { AiProvider, ReadingLevel } from '@ai-teacher/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001';

async function postJson<T>(path: string, body: unknown, fallbackMessage: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export function simplifyText(input: { text: string; readingLevel: ReadingLevel; provider: AiProvider }) {
  return postJson<{ text: string; provider: AiProvider }>('/ai/simplify', input, 'The app is having difficulty simplifying this text.');
}

export function explainContext(input: { text: string; provider: AiProvider }) {
  return postJson<{ explanation: string; provider: AiProvider }>('/ai/explain-context', input, 'The app is having difficulty explaining context.');
}

export function explainGaps(input: { text: string; missed: string[]; attempt?: number; provider: AiProvider }) {
  return postJson<{ explanation: string; provider: AiProvider }>('/ai/explain-gaps', input, 'The app is having difficulty explaining missed ideas.');
}

export function defineVocabulary(input: { term: string; contextText: string; readingLevel?: ReadingLevel; provider: AiProvider }) {
  return postJson<{ definition: string; provider: AiProvider }>('/ai/define', input, 'The app is having difficulty defining this word.');
}

export interface SentenceFrame {
  frame: string;
  hint: string;
}

export function generateSentenceFrames(input: { text: string; missed: string[]; studentTranscript: string; provider: AiProvider }) {
  return postJson<{ frames: SentenceFrame[]; provider: AiProvider }>('/ai/generate-sentence-frames', input, 'The app is having difficulty generating sentence frames.');
}

export function gradeFrameCompletion(input: { frame: string; completion: string; passageText: string; provider: AiProvider }) {
  return postJson<{ passed: boolean; feedback: string; provider: AiProvider }>('/ai/grade-frame', input, 'The app is having difficulty grading this answer.');
}
