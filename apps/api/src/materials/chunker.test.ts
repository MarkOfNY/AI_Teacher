import { describe, expect, it } from 'vitest';
import { chunkText, countSentences } from './chunker';

describe('chunkText', () => {
  it('keeps related sentences together by default', () => {
    const chunks = chunkText('First sentence. Second sentence.');
    expect(chunks).toEqual([
      { index: 0, text: 'First sentence. Second sentence.' }
    ]);
  });

  it('keeps short single text as one chunk', () => {
    const chunks = chunkText('One short passage.');
    expect(chunks).toEqual([{ index: 0, text: 'One short passage.' }]);
  });

  it('uses paragraph breaks as natural reading part boundaries', () => {
    const chunks = chunkText('  A.  \n\n  \n\n B. ');
    expect(chunks).toEqual([
      { index: 0, text: 'A.' },
      { index: 1, text: 'B.' }
    ]);
  });

  it('groups many short paragraph lines into readable parts', () => {
    const chunks = chunkText('Title\n\nShort heading\n\nFirst idea continues here\n\nSecond idea continues here\n\nThird idea continues here');

    expect(chunks).toEqual([
      { index: 0, text: 'Title Short heading First idea continues here Second idea continues here Third idea continues here' }
    ]);
  });

  it('counts sentences for reading part choices', () => {
    expect(countSentences('One. Two? Three!')).toBe(3);
  });

  it('splits sentences evenly into the requested number of reading parts', () => {
    const chunks = chunkText('One. Two. Three. Four.', { readingPartCount: 2 });

    expect(chunks).toEqual([
      { index: 0, text: 'One. Two.' },
      { index: 1, text: 'Three. Four.' }
    ]);
  });

  it('splits paragraph blocks when requested text has too few sentence endings', () => {
    const chunks = chunkText('Title\n\nShort heading\n\nFirst idea\n\nSecond idea', { readingPartCount: 2 });

    expect(chunks).toEqual([
      { index: 0, text: 'Title Short heading' },
      { index: 1, text: 'First idea Second idea' }
    ]);
  });

  it('keeps complete sentences when reducing a long paragraph into suggested-sized parts', () => {
    const chunks = chunkText(Array.from({ length: 24 }, (_unused, index) => `Sentence ${index + 1}.`).join(' '));

    expect(chunks).toEqual([
      { index: 0, text: 'Sentence 1. Sentence 2. Sentence 3. Sentence 4. Sentence 5. Sentence 6. Sentence 7. Sentence 8.' },
      { index: 1, text: 'Sentence 9. Sentence 10. Sentence 11. Sentence 12. Sentence 13. Sentence 14. Sentence 15. Sentence 16.' },
      { index: 2, text: 'Sentence 17. Sentence 18. Sentence 19. Sentence 20. Sentence 21. Sentence 22. Sentence 23. Sentence 24.' }
    ]);
  });

  it('breaks long legal-style passages into smaller contextual reading parts', () => {
    const text = [
      'Segregation of children in public schools solely on the basis of race denies equal protection even when physical facilities may be equal.',
      '(a) The history of the Fourteenth Amendment is inconclusive as to its intended effect on public education.',
      '(b) The question must be determined in light of the full development of public education and its place in American life.',
      '(c) Separate educational facilities are inherently unequal because separating children by race can affect their hearts and minds.',
      'The judgment of the District Court is reversed and the cases are remanded for further proceedings.'
    ].join(' ');

    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.split(/\s+/).length <= 130)).toBe(true);
    expect(chunks[0].text).toContain('equal protection');
    expect(chunks[1].text).toContain('Fourteenth Amendment');
  });

  it('splits oversized copied paragraphs instead of keeping each paragraph as a huge part', () => {
    const longParagraph = [
      'Opening context explains the case and the constitutional question for students.',
      '(a) The first connected idea explains the amendment history and why it was unclear.',
      '(b) The second connected idea explains why education had changed by the time of the decision.',
      '(c) The third connected idea explains why separation itself harmed equal educational opportunity.',
      'The paragraph continues with extra copied text that should not force students to handle one oversized reading part.'
    ].join(' ');
    const chunks = chunkText(`${longParagraph} ${longParagraph}\n\nA short closing paragraph.`);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.text.split(/\s+/).length <= 130)).toBe(true);
  });

  it('keeps legal source text in readable sections instead of shredding it into tiny parts', () => {
    const text = Array.from({ length: 36 }, (_unused, index) => {
      const marker = index % 6 === 0 ? `(${String.fromCharCode(97 + (index / 6))}) ` : '';
      return `${marker}This connected legal point explains education, equal protection, history, and public schools for students.`;
    }).join(' ');

    const chunks = chunkText(text);
    const wordCounts = chunks.map((chunk) => chunk.text.split(/\s+/).length);

    expect(chunks.length).toBeLessThanOrEqual(6);
    expect(Math.max(...wordCounts)).toBeLessThanOrEqual(130);
    expect(Math.min(...wordCounts)).toBeGreaterThanOrEqual(45);
  });

  it('caps reading part count at the number of sentences', () => {
    const chunks = chunkText('One. Two.', { readingPartCount: 10 });

    expect(chunks).toEqual([
      { index: 0, text: 'One.' },
      { index: 1, text: 'Two.' }
    ]);
  });
});
