import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePdf = join(__dirname, '../node_modules/.pnpm/pdf-parse@1.1.1/node_modules/pdf-parse/test/data/01-valid.pdf');

const buffer = readFileSync(samplePdf);
const form = new FormData();
form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'sample.pdf');

console.log('Sending PDF to /materials/extract-file...\n');
const res = await fetch('http://localhost:3001/materials/extract-file', { method: 'POST', body: form });
const json = await res.json();

if (res.ok) {
  console.log('✓ Status:', res.status);
  console.log('✓ Extracted text (first 300 chars):\n');
  console.log(json.text.slice(0, 300));
} else {
  console.error('✗ Error:', json.error);
}
