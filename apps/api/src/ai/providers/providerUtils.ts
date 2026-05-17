import type { ReadingLevel, ScoreResult } from '@ai-teacher/shared';
import { throwProviderError } from './providerErrors';

export interface ProviderConfig {
  apiUrl: string;
  model: string;
  visionModel?: string;
  name: string;
  missingKeyMessage: string;
}

async function chatWithVision(config: ProviderConfig, apiKey: string, imageBase64: string, mimeType: string): Promise<string> {
  if (!apiKey) throw new Error(config.missingKeyMessage);
  const model = config.visionModel ?? config.model;
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: 'Extract all text from this image exactly as it appears. Preserve paragraphs, headings, lists, and structure. Return only the extracted text with no commentary.' }
        ]
      }],
      max_tokens: 4096,
      temperature: 0.1
    })
  });
  if (!response.ok) await throwProviderError(config.name, response);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function chat(config: ProviderConfig, apiKey: string, prompt: string, temperature = 0.2): Promise<string> {
  if (!apiKey) throw new Error(config.missingKeyMessage);
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a patient reading comprehension tutor. Use clear, short sentences and preserve the meaning of the original text.'
        },
        { role: 'user', content: prompt }
      ],
      temperature
    })
  });
  if (!response.ok) await throwProviderError(config.name, response);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export function parseScoreResult(content: string, threshold: number): ScoreResult {
  const parsed = JSON.parse(content) as Partial<ScoreResult>;
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 0))));
  return {
    score,
    passed: score >= threshold,
    rubric: {
      mainIdea: Number(parsed.rubric?.mainIdea ?? score),
      keyDetails: Number(parsed.rubric?.keyDetails ?? score),
      context: Number(parsed.rubric?.context ?? score),
      whyItMatters: Number(parsed.rubric?.whyItMatters ?? score),
      accuracy: Number(parsed.rubric?.accuracy ?? score)
    },
    understood: Array.isArray(parsed.understood) ? parsed.understood : [],
    missed: Array.isArray(parsed.missed) ? parsed.missed : [],
    feedback: typeof parsed.feedback === 'string' ? parsed.feedback : 'AI scoring completed.'
  };
}

export function parseReadingPartCount(content: string): number {
  const match = content.match(/\d+/);
  return Math.max(1, Math.round(Number(match?.[0] ?? 1)));
}

export function buildProviderClient(config: ProviderConfig, apiKey: string) {
  const send = (prompt: string, temperature?: number) => chat(config, apiKey, prompt, temperature);

  return {
    async simplifyText(input: { text: string; readingLevel: ReadingLevel; hint?: string; temperature?: number }) {
      const hintClause = input.hint ? ` ${input.hint}` : '';
      return send(`Rewrite this for reading level "${input.readingLevel}". Keep the important ideas.${hintClause}\n\n${input.text}`, input.temperature);
    },
    async explainContext(input: { text: string }) {
      return send(`Explain what this means and why it matters. Keep it simple. Never begin with meta-commentary about the text itself — do not use phrases like "This text says", "This text talks about", "This text lists", "This passage explains", "The text states", or any variation. Do not identify the document or source. Jump straight into the explanation as if you are a tutor speaking directly to a student.\n\n${input.text}`);
    },
    async explainGaps(input: { text: string; missed: string[]; attempt?: number }) {
      const strategy = ((input.attempt ?? 1) - 1) % 4;
      const angle = [
        'Focus on cause and effect: what caused this situation and what resulted from it. Stay grounded in the actual events and details.',
        'Break it down into its most important points one at a time, in the order a student needs to understand them. Stay grounded in the actual events and details.',
        'Identify the single most important idea first, then show how every other detail in the text connects to it. Stay grounded in the actual events and details.',
        'Walk through what happened step by step and explain why each step led to the next. Stay grounded in the actual events and details.'
      ][strategy];
      return send(`Re-explain the following content using clearer, simpler language. ${angle} Respond with only the explanation itself, no introduction or preamble.\n\nText:\n${input.text}`);
    },
    async defineVocabulary(input: { term: string; contextText: string }) {
      return send(`Define the word or phrase "${input.term}" for a student. Use the surrounding text to choose the right meaning. Keep the answer short and concrete.\n\nSurrounding text:\n${input.contextText}`);
    },
    async suggestReadingPartCount(input: { text: string }) {
      const content = await send(`Suggest the best number of coherent reading parts for this lesson text. Keep sentences together and avoid tiny title-only or fragment-only chunks. Aim for parts a student can read and summarize one at a time. Return only one integer.\n\nText:\n${input.text}`);
      return parseReadingPartCount(content);
    },
    async scoreParaphrase(input: { referenceText: string; transcript: string; threshold: number }) {
      const content = await send(`Score this paraphrase against the reference text. The reference text may be a simplified version of the original, so judge on whether the key ideas and concepts were captured — not on whether specific vocabulary from the reference was used. Accept any wording, synonyms, or phrasing that conveys the same meaning. Do not list specific words or phrases as "missed" if the same idea was expressed in different words. If all core ideas are present, score at or above the passing threshold. Write the feedback field directly to the student using "you" and "your" — never refer to "the student". Return only valid JSON matching this shape: {"score":number,"rubric":{"mainIdea":number,"keyDetails":number,"context":number,"whyItMatters":number,"accuracy":number},"understood":["string"],"missed":["string"],"feedback":"string"}.\n\nPassing threshold: ${input.threshold}\n\nReference text:\n${input.referenceText}\n\nParaphrase:\n${input.transcript}`);
      return parseScoreResult(content, input.threshold);
    },
    async extractTextFromImage(input: { imageBase64: string; mimeType: string }) {
      return chatWithVision(config, apiKey, input.imageBase64, input.mimeType);
    }
  };
}
