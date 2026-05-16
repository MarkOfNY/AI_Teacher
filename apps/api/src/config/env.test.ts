import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('API env examples', () => {
  it('points Prisma SQLite to the API dev database from the prisma schema directory', () => {
    const example = readFileSync('.env.example', 'utf-8');

    expect(example).toContain('DATABASE_URL="file:../dev.db"');
  });
});
