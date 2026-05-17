import * as path from 'path';
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

// Real PDF from pdf-parse test suite — known to contain readable text
const SAMPLE_PDF = path.join(
  __dirname,
  '../node_modules/.pnpm/pdf-parse@1.1.1/node_modules/pdf-parse/test/data/01-valid.pdf'
);

test.describe('File upload', () => {
  test('uploading a PDF extracts text into the material textarea', async ({ page }) => {
    await page.goto(`${BASE}?qaSession=true`);
    await page.getByRole('tab', { name: 'Manage Lessons' }).click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(SAMPLE_PDF);

    const textarea = page.getByLabel(/material text/i);
    await expect(textarea).not.toHaveValue('', { timeout: 15_000 });

    const text = await textarea.inputValue();
    console.log('Extracted text (first 200 chars):', text.slice(0, 200));
    expect(text.length).toBeGreaterThan(50);
  });

  test('title field is populated from the filename after PDF upload', async ({ page }) => {
    await page.goto(`${BASE}?qaSession=true`);
    await page.getByRole('tab', { name: 'Manage Lessons' }).click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(SAMPLE_PDF);

    const titleInput = page.getByLabel(/title/i);
    await expect(titleInput).not.toHaveValue('', { timeout: 15_000 });

    const title = await titleInput.inputValue();
    console.log('Auto-filled title:', title);
    expect(title).toBeTruthy();
  });

  test('error shown for corrupt PDF', async ({ page }) => {
    await page.goto(`${BASE}?qaSession=true`);
    await page.getByRole('tab', { name: 'Manage Lessons' }).click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'bad.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 junk'),
    });

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  });
});
