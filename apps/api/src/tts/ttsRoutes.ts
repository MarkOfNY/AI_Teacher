import express from 'express';

const GOOGLE_TTS_URL = 'https://translate.google.com/translate_tts';
const MAX_CHUNK = 190;

function splitText(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHUNK) {
    let split = remaining.lastIndexOf(' ', MAX_CHUNK);
    if (split <= 0) split = MAX_CHUNK;
    chunks.push(remaining.slice(0, split).trim());
    remaining = remaining.slice(split).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export function createTtsRouter() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const text = typeof req.query.text === 'string' ? req.query.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'text query parameter is required' });
      return;
    }

    const chunks = splitText(text);
    const buffers: Buffer[] = [];

    for (const chunk of chunks) {
      const url = `${GOOGLE_TTS_URL}?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=en&client=tw-ob`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!response.ok) {
        res.status(502).json({ error: `Google TTS returned ${response.status}` });
        return;
      }
      buffers.push(Buffer.from(await response.arrayBuffer()));
    }

    const audio = Buffer.concat(buffers);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', String(audio.length));
    res.send(audio);
  });

  return router;
}
