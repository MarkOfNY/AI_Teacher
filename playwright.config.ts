import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs watch apps/api/src/server.ts',
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'pnpm --filter @ai-teacher/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
