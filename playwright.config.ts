import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
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
      command: 'node node_modules/.pnpm/vite@6.4.2_@types+node@25.6.2_jiti@2.7.0_tsx@4.21.0/node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --root apps/web',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
