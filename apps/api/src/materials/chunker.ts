export interface TextChunkDraft {
  index: number;
  text: string;
}

interface ChunkTextOptions {
  readingPartCount?: number;
}

const TARGET_PARAGRAPH_WORDS = 115;
const MIN_PARAGRAPH_GROUP_WORDS = 70;
const SHORT_PARAGRAPH_GROUP_THRESHOLD = 3;
const TARGET_SENTENCES_PER_READING_PART = 10;
const TARGET_READING_PART_WORDS = 115;

function countWords(text: string) {
  return text.match(/\S+/g)?.length ?? 0;
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
}

function suggestedPartCountForText(text: string) {
  const sentenceCount = countSentences(text);
  const wordCount = countWords(text);
  return Math.max(
    1,
    Math.ceil(sentenceCount / TARGET_SENTENCES_PER_READING_PART),
    Math.ceil(wordCount / TARGET_READING_PART_WORDS)
  );
}

const MIN_STANDALONE_PARAGRAPH_WORDS = 5;

function isSourceCitation(paragraph: string) {
  return /^source[:\s]/i.test(paragraph) || /^https?:\/\/\S+$/i.test(paragraph);
}

function splitParagraphs(text: string) {
  const raw = text
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => Boolean(paragraph) && !isSourceCitation(paragraph));

  // Merge fragments that are too short to stand alone (e.g. lone section numbers)
  // into the paragraph that follows them.
  const merged: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (countWords(raw[i]) < MIN_STANDALONE_PARAGRAPH_WORDS && i + 1 < raw.length) {
      merged.push(`${raw[i]} ${raw[i + 1]}`);
      i++;
    } else {
      merged.push(raw[i]);
    }
  }
  return merged;
}

function reindex(chunks: string[]): TextChunkDraft[] {
  return chunks.map((text, index) => ({ index, text }));
}

function chunkByParagraphGroups(paragraphs: string[]) {
  const hasOversizedParagraph = paragraphs.some((paragraph) => countWords(paragraph) > TARGET_PARAGRAPH_WORDS);
  if (paragraphs.length < SHORT_PARAGRAPH_GROUP_THRESHOLD && !hasOversizedParagraph) {
    return reindex(paragraphs);
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph);
    if (paragraphWords > TARGET_PARAGRAPH_WORDS) {
      if (current.length > 0) {
        chunks.push(current.join(' '));
        current = [];
        currentWords = 0;
      }
      chunks.push(...chunkSentencesContextually(splitSentences(paragraph), suggestedPartCountForText(paragraph)).map((chunk) => chunk.text));
      continue;
    }

    const nextWords = currentWords + paragraphWords;
    const shouldStartNext =
      current.length > 0
      && currentWords >= MIN_PARAGRAPH_GROUP_WORDS
      && nextWords > TARGET_PARAGRAPH_WORDS;

    if (shouldStartNext) {
      chunks.push(current.join(' '));
      current = [];
      currentWords = 0;
    }

    current.push(paragraph);
    currentWords += paragraphWords;

    if (currentWords >= TARGET_PARAGRAPH_WORDS) {
      chunks.push(current.join(' '));
      current = [];
      currentWords = 0;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(' '));
  }

  return reindex(chunks);
}

export function countSentences(text: string) {
  return splitSentences(text).length;
}

function chunkUnitsEvenly(units: string[], readingPartCount: number): TextChunkDraft[] {
  if (units.length === 0) return [];

  const partCount = Math.max(1, Math.min(readingPartCount, units.length));
  const baseSize = Math.floor(units.length / partCount);
  const remainder = units.length % partCount;
  const chunks: TextChunkDraft[] = [];
  let cursor = 0;

  for (let index = 0; index < partCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    const part = units.slice(cursor, cursor + size).join(' ');
    chunks.push({ index, text: part });
    cursor += size;
  }

  return chunks;
}

function chunkBySentences(text: string, readingPartCount: number): TextChunkDraft[] {
  return chunkUnitsEvenly(splitSentences(text), readingPartCount);
}

function startsNewLegalPoint(sentence: string) {
  return /^\([a-z]\)\s+/i.test(sentence.trim());
}

function chunkSentencesContextually(sentences: string[], desiredPartCount: number) {
  if (sentences.length === 0) return [];

  const totalWords = countWords(sentences.join(' '));
  const targetWords = Math.min(
    TARGET_READING_PART_WORDS,
    Math.max(1, Math.ceil(totalWords / Math.max(1, desiredPartCount)))
  );
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    const shouldStartNew =
      current.length > 0
      && (
        startsNewLegalPoint(sentence)
        || currentWords + sentenceWords > targetWords
      );

    if (shouldStartNew) {
      chunks.push(current.join(' '));
      current = [];
      currentWords = 0;
    }

    current.push(sentence);
    currentWords += sentenceWords;
  }

  if (current.length > 0) {
    chunks.push(current.join(' '));
  }

  return reindex(chunks);
}

export function chunkText(text: string, options: ChunkTextOptions = {}): TextChunkDraft[] {
  if (options.readingPartCount) {
    const sentences = splitSentences(text);
    if (sentences.length > 1) {
      return chunkUnitsEvenly(sentences, options.readingPartCount);
    }

    const paragraphs = splitParagraphs(text);
    if (paragraphs.length > 1) {
      return chunkUnitsEvenly(paragraphs, options.readingPartCount);
    }

    return chunkUnitsEvenly(sentences, options.readingPartCount);
  }

  const paragraphs = splitParagraphs(text);
  if (paragraphs.length > 1) {
    return chunkByParagraphGroups(paragraphs);
  }

  return chunkSentencesContextually(splitSentences(text), suggestedPartCountForText(text));
}
