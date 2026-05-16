import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import type { AiProvider } from '@ai-teacher/shared';

export interface AiErrorLogInput {
  task: string;
  provider: AiProvider;
  error: unknown;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function logAiError(input: AiErrorLogInput) {
  const logDirectory = path.resolve('logs');
  await mkdir(logDirectory, { recursive: true });
  const record = {
    timestamp: new Date().toISOString(),
    task: input.task,
    provider: input.provider,
    error: errorMessage(input.error)
  };

  await appendFile(path.join(logDirectory, 'ai-errors.log'), `${JSON.stringify(record)}\n`, 'utf-8');
}
