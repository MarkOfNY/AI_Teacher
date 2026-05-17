import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';

// Minimal valid 8x8 PNG (white pixels, no text — used to verify the zone accepts images
// and calls the API; real content tested via the API route directly)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('AI Teacher smoke tests', () => {
  test('login page loads', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: 'AI Teacher' })).toBeVisible();
    await expect(page.getByText('Sign in')).toBeVisible();
  });

  test('dev session auto-login via qaSession param', async ({ page }) => {
    await page.goto(`${BASE}?qaSession=true`);
    await expect(page.getByRole('heading', { name: 'AI Teacher' })).toBeVisible();
    // Should show the tabbed workspace, not the login panel
    await expect(page.getByRole('tab', { name: 'Take Lesson' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Manage Lessons' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
  });

  test('Manage Lessons tab shows material editor', async ({ page }) => {
    await page.goto(`${BASE}?qaSession=true`);
    await page.getByRole('tab', { name: 'Manage Lessons' }).click();
    await expect(page.getByRole('heading', { name: /lesson/i })).toBeVisible();
  });

  test('Settings tab shows mastery thresholds and AI routing', async ({ page }) => {
    await page.goto(`${BASE}?qaSession=true`);
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Mastery Thresholds' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI Provider Routing' })).toBeVisible();
  });

  test('API health endpoint responds', async ({ request }) => {
    const response = await request.get(`${API}/health`);
    expect(response.status()).toBe(200);
  });

  test('upload zone is present on Manage Lessons tab', async ({ page }) => {
    await page.goto(`${BASE}?qaSession=true`);
    await page.getByRole('tab', { name: 'Manage Lessons' }).click();
    const zone = page.getByRole('button', { name: /upload file/i });
    await expect(zone).toBeVisible();
    await expect(zone).toContainText(/drop a file/i);
    await expect(zone).toContainText(/PDF/i);
  });

  test('upload zone shows error for unsupported file type', async ({ page }) => {
    const tmpFile = path.join(os.tmpdir(), 'test-unsupported.xyz');
    fs.writeFileSync(tmpFile, 'some content');

    await page.goto(`${BASE}?qaSession=true`);
    await page.getByRole('tab', { name: 'Manage Lessons' }).click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: 'test.xyz', mimeType: 'application/octet-stream', buffer: Buffer.from('hello') });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/not a supported type/i);

    fs.unlinkSync(tmpFile);
  });

  test('API extract-file rejects unsupported type', async ({ request }) => {
    const form = new FormData();
    form.append('file', new Blob(['hello'], { type: 'text/plain' }), 'test.txt');
    const response = await request.post(`${API}/materials/extract-file`, { multipart: { file: { name: 'test.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') } } });
    expect(response.status()).toBe(400);
  });

  test('can create and select a lesson', async ({ page, request }) => {
    const title = `E2E Lesson ${Date.now()}`;
    await page.goto(`${BASE}?qaSession=true`);
    await page.getByRole('tab', { name: 'Manage Lessons' }).click();
    await page.getByLabel(/title/i).fill(title);
    await page.getByLabel(/material text/i).fill(
      'The water cycle describes how water evaporates from the surface of the earth, rises into the atmosphere, cools and condenses into rain or snow in clouds, and falls again to the surface as precipitation.'
    );
    await page.getByRole('button', { name: /create/i }).click();
    // Should switch to Take Lesson tab and the new lesson should be selected
    await expect(page.getByRole('tab', { name: 'Take Lesson' })).toHaveAttribute('aria-selected', 'true');
    const select = page.getByLabel('Choose lesson');
    await expect(select).toHaveValue(/.+/);

    // Clean up: delete the lesson created by this test run so the DB stays tidy
    const materialId = await select.inputValue();
    if (materialId) {
      await request.delete(`${API}/materials/${materialId}`);
    }

    // Also clean up any leftover E2E Lesson entries from previous runs
    const session = await (await request.post(`${API}/dev-session`)).json() as { user: { id: string } };
    const materials = await (await request.get(`${API}/materials?userProfileId=${session.user.id}`)).json() as Array<{ id: string; title: string }>;
    for (const m of materials) {
      if (m.title.startsWith('E2E Lesson ') && m.id !== materialId) {
        await request.delete(`${API}/materials/${m.id}`);
      }
    }
  });
});
