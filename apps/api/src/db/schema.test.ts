import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Prisma schema', () => {
  const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');

  it('defines core AI Teacher models', () => {
    expect(schema).toContain('model User');
    expect(schema).toContain('model UserProfile');
    expect(schema).toContain('model Material');
    expect(schema).toContain('model MaterialChunk');
    expect(schema).toContain('model ParaphraseAttempt');
    expect(schema).toContain('model AiRoutingPreference');
  });
});
