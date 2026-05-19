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
          { type: 'text', text: 'Extract all text from this image and format it as clean HTML. Use <h1>, <h2>, <h3> for headings, <p> for paragraphs, <strong> for bold text, <em> for italic text, <ul>/<li> for bullet lists, <ol>/<li> for numbered lists. Preserve the document structure, hierarchy, and emphasis exactly as it appears. Return only the HTML content — no DOCTYPE, no <html> or <body> tags, no markdown code fences, no commentary.' }
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
    async structureTextAsHtml(input: { text: string }) {
      return send(`Convert this plain text extracted from a PDF into clean, structured HTML. Infer structure from patterns: short standalone lines are headings (use <h2> or <h3>), prose paragraphs become <p>, lines starting with -, *, or • become <ul><li> items, numbered lines become <ol><li> items. Preserve all content exactly — do not summarize or omit anything. Return only the HTML — no DOCTYPE, no <html>/<body> tags, no commentary.\n\n${input.text}`, 0.1);
    },
    async defineVocabulary(input: { term: string; contextText: string; readingLevel?: string }) {
      const levelNote = input.readingLevel === 'verySimple'
        ? 'Use very simple words, as if explaining to a young child.'
        : input.readingLevel === 'simple'
        ? 'Use simple, everyday language appropriate for an elementary student.'
        : input.readingLevel === 'middleSchool'
        ? 'Use clear language appropriate for a middle school student.'
        : 'Use clear, accessible language.';
      return send(`Define the word or phrase "${input.term}" for a student. ${levelNote} Use the surrounding text to choose the right meaning. Keep the answer short and concrete — one or two sentences.\n\nSurrounding text:\n${input.contextText}`);
    },
    async extractKeyTerms(input: { text: string }) {
      return send(`Identify 3 to 5 phrases or short clauses from this text that carry the most important ideas — the core claims, facts, or arguments a student must remember. These should be exact or near-exact phrases from the text itself, not vocabulary explanations. Prefer meaningful phrases over single words. Return only valid JSON — an array of objects with "term" (the exact phrase from the text) and "definition" (one sentence on why this idea matters). No commentary outside the JSON.\n\nExample: [{"term":"life, liberty and the pursuit of happiness","definition":"The three rights the Declaration says all people are born with."}]\n\nText:\n${input.text}`, 0.2);
    },
    async gradeFrameCompletion(input: { frame: string; completion: string; passageText: string }) {
      const fullSentence = input.frame.replace('___', input.completion);
      const content = await send(`A student completed a sentence frame about a reading passage. Grade their answer as correct or incorrect based on whether the completion accurately reflects the passage. Accept synonyms, paraphrasing, and reasonable alternatives — only mark incorrect if the answer is factually wrong, irrelevant, or too vague to demonstrate understanding. Return only valid JSON: {"passed":boolean,"feedback":"one short sentence for the student explaining what is wrong, or empty string if correct"}.\n\nPassage:\n${input.passageText}\n\nCompleted sentence:\n${fullSentence}`, 0.1);
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content) as { passed?: boolean; feedback?: string };
        return { passed: Boolean(parsed.passed), feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '' };
      } catch {
        return { passed: false, feedback: '' };
      }
    },
    async generateSentenceFrames(input: { text: string; missed: string[]; studentTranscript: string }) {
      const missedList = input.missed.length > 0 ? input.missed.join(', ') : 'key ideas from the text';
      return send(`A student is struggling to summarize a reading passage. Create 2-3 sentence frames that guide them toward the ideas they missed. Each frame must start with useful words but leave a blank ("___") for the student to complete, targeting the specific missed concepts. Keep the language simple. Return only valid JSON — an array of objects with "frame" (the sentence with blank) and "hint" (a specific memory cue that helps the student recall the answer — describe WHAT the answer is using background knowledge or context clues, never reference where it appears in the text; never say "mentioned in the text", "at the beginning", "in the passage", "in the second sentence", or any phrase pointing to text location; instead give a conceptual clue like "A Founding Father from Virginia who later became the third U.S. president" or "The same year as the very first Fourth of July celebration"). No commentary outside the JSON.\n\nExample: [{"frame":"The colonists declared independence in ___","hint":"The same year as the very first Fourth of July celebration"},{"frame":"The document was mainly written by ___","hint":"A Founding Father from Virginia who later became the third U.S. president"}]\n\nPassage:\n${input.text}\n\nIdeas the student missed: ${missedList}\n\nStudent's attempt:\n${input.studentTranscript}`, 0.3);
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
