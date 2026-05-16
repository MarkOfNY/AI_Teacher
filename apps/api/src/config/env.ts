import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Load .env relative to this file so the path is correct regardless of CWD
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default('file:./dev.db'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  DEEPSEEK_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  QWEN_API_KEY: z.string().default('')
});

export const env = EnvSchema.parse(process.env);
