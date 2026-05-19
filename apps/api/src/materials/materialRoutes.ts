import { createRequire } from 'module';
import multer from 'multer';
import { Router } from 'express';

const require = createRequire(import.meta.url);
// pdf-parse is CommonJS — must be loaded via require in this ESM context
type PdfPageProxy = {
  getTextContent(): Promise<{ items: Array<{ str: string; transform: number[]; width: number; height: number } | Record<string, unknown>> }>;
};
type PdfParseOptions = { pagerender?: (page: PdfPageProxy) => Promise<string> };
const pdfParse = require('pdf-parse') as (buffer: Buffer, options?: PdfParseOptions) => Promise<{ text: string }>;
import { z } from 'zod';
import type { AiProvider } from '@ai-teacher/shared';
import { aiTeachingService } from '../ai/aiTeachingService';
import { materialService } from './materialService';
import { AiProviderError } from '../ai/providers/providerErrors';

function friendlyProviderError(err: AiProviderError): string {
  const name = err.provider;
  if (err.status === 429) {
    return `${name} API quota exceeded. Check your billing or usage limits at the ${name} dashboard.`;
  }
  if (err.status === 401 || err.status === 403) {
    return `${name} API key is invalid or missing. Check the API key in your server configuration.`;
  }
  if (err.providerMessage.includes('image_url') || err.providerMessage.includes('vision')) {
    return `${name} does not support image extraction on this API plan or model.`;
  }
  return `${name} returned an error (${err.status}): ${err.providerMessage}`;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);

// Extracts text from a PDF with structural HTML markup by reading per-item
// x/y positions to detect indentation, heading size, and paragraph breaks.
async function extractHtmlFromPdf(buffer: Buffer): Promise<string> {
  const htmlParts: string[] = [];

  await pdfParse(buffer, {
    pagerender: async (page: PdfPageProxy) => {
      const { items } = await page.getTextContent();

      const positioned = items
        .filter((item): item is { str: string; transform: number[]; width: number; height: number } =>
          'str' in item && typeof item.str === 'string' && Boolean(item.str.trim())
        )
        .map((item) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],       // PDF y-up: higher = closer to top
          h: Math.abs(item.height) || Math.abs(item.transform[3]) || 12
        }));

      if (positioned.length === 0) return '';

      // Sort top-to-bottom (descending PDF y), then left-to-right
      positioned.sort((a, b) => b.y - a.y || a.x - b.x);

      // Determine body font height (most frequent)
      const hFreq = new Map<number, number>();
      for (const item of positioned) {
        const h = Math.round(item.h);
        if (h > 0) hFreq.set(h, (hFreq.get(h) ?? 0) + 1);
      }
      const bodyH = hFreq.size > 0 ? [...hFreq.entries()].sort((a, b) => b[1] - a[1])[0][0] : 12;
      const lineTol = Math.max(2, bodyH * 0.45);

      // Group items into visual lines using y-proximity
      const lines: Array<{ text: string; x: number; y: number; h: number }> = [];
      let lineItems: typeof positioned = [];

      const flushLine = () => {
        if (!lineItems.length) return;
        lineItems.sort((a, b) => a.x - b.x);
        const text = lineItems.map((i) => i.str).join('').trim();
        if (text) {
          lines.push({ text, x: lineItems[0].x, y: lineItems[0].y, h: Math.max(...lineItems.map((i) => i.h)) });
        }
        lineItems = [];
      };

      for (const item of positioned) {
        if (lineItems.length === 0 || Math.abs(item.y - lineItems[0].y) <= lineTol) {
          lineItems.push(item);
        } else {
          flushLine();
          lineItems = [item];
        }
      }
      flushLine();

      if (lines.length === 0) return '';

      // Determine base left margin (most common x bucket)
      const xFreq = new Map<number, number>();
      for (const line of lines) {
        const bucket = Math.round(line.x / 8) * 8;
        xFreq.set(bucket, (xFreq.get(bucket) ?? 0) + 1);
      }
      const baseX = [...xFreq.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const INDENT_THRESHOLD = baseX + 15;

      // Group consecutive lines into paragraphs by y-gap.
      // Lines within ~1.7× the body font height apart are the same paragraph;
      // a larger gap means a new paragraph (or heading/blockquote always break).
      const PARA_GAP = bodyH * 1.7;

      type LineBlock = { texts: string[]; h: number; isHeading: boolean; headingLevel?: 1 | 2 | 3; isBlockquote: boolean };
      const blocks: LineBlock[] = [];
      let cur: LineBlock | null = null;
      let prevY: number | null = null;

      for (const line of lines) {
        const isBlockquote = line.x >= INDENT_THRESHOLD;
        const isHeadingLine = !isBlockquote && line.h >= bodyH * 1.15 && line.text.length < 90 && !/[.,;]$/.test(line.text);
        const bigGap = prevY !== null && (prevY - line.y) > PARA_GAP;
        const typeChange = cur !== null && (isHeadingLine || cur.isHeading || isBlockquote !== cur.isBlockquote);

        if (!cur || bigGap || typeChange) {
          if (cur) blocks.push(cur);
          cur = {
            texts: [line.text],
            h: line.h,
            isHeading: isHeadingLine,
            headingLevel: isHeadingLine ? (line.h >= bodyH * 1.5 ? 1 : line.h >= bodyH * 1.3 ? 2 : 3) : undefined,
            isBlockquote
          };
        } else {
          cur.texts.push(line.text);
        }
        prevY = line.y;
      }
      if (cur) blocks.push(cur);

      const html = blocks.map((block) => {
        const text = block.texts.join(' ');
        if (block.isHeading) return `<h${block.headingLevel}>${text}</h${block.headingLevel}>`;
        if (block.isBlockquote) return `<blockquote>${text}</blockquote>`;
        return `<p>${text}</p>`;
      });

      htmlParts.push(html.join('\n'));
      return '';
    }
  });

  return htmlParts.join('\n');
}

// Extract embedded JPEG images from a PDF buffer (works for scanned/image-only PDFs).
// Scanned PDFs are typically JPEG images wrapped in a PDF container.
function extractJpegsFromPdf(buffer: Buffer): Buffer[] {
  const images: Buffer[] = [];
  let i = 0;
  while (i < buffer.length - 3) {
    // JPEG start: FF D8 FF
    if (buffer[i] === 0xFF && buffer[i + 1] === 0xD8 && buffer[i + 2] === 0xFF) {
      let j = i + 2;
      while (j < buffer.length - 1) {
        // JPEG end: FF D9
        if (buffer[j] === 0xFF && buffer[j + 1] === 0xD9) {
          images.push(buffer.subarray(i, j + 2));
          i = j + 2;
          break;
        }
        j++;
      }
      if (j >= buffer.length - 1) break;
    } else {
      i++;
    }
  }
  return images;
}

// Used when pdf-parse finds no text — PDF is image-based (scanned).
// Extracts embedded JPEGs from the PDF and sends them to Qwen VL.
async function extractTextFromScannedPdf(buffer: Buffer): Promise<string> {
  const images = extractJpegsFromPdf(buffer);
  if (images.length === 0) return '';

  const texts = await Promise.all(
    images.map((img) =>
      aiTeachingService.extractTextFromImage({
        provider: 'qwen',
        imageBase64: img.toString('base64'),
        mimeType: 'image/jpeg'
      }).catch(() => '')
    )
  );
  return texts.filter(Boolean).join('\n\n');
}

const CreateMaterialSchema = z.object({
  userProfileId: z.string().min(1),
  title: z.string().min(1),
  originalText: z.string().min(1),
  readingPartCount: z.number().int().min(1).optional()
});

const UpdateMaterialSchema = z.object({
  title: z.string().min(1),
  originalText: z.string().min(1)
});

const SubmitAttemptSchema = z.object({
  scope: z.enum(['chunk', 'final']),
  chunkId: z.string().min(1).optional(),
  transcript: z.string().min(1),
  referenceText: z.string().optional()
});

const UpdateReadingPartsSchema = z.object({
  readingPartCount: z.number().int().min(1)
});

const SuggestReadingPartsSchema = z.object({
  provider: z.enum(['qwen', 'deepseek', 'openai', 'disabled', 'browserTts']).default('qwen')
});

const GenerateSimplificationsSchema = z.object({
  readingLevel: z.enum(['verySimple', 'simple', 'middleSchool']),
  provider: z.enum(['qwen', 'deepseek', 'openai']).default('qwen')
});

const SaveContextExplanationSchema = z.object({
  explanation: z.string().min(1)
});

export interface MaterialServiceLike {
  createMaterial(input: z.infer<typeof CreateMaterialSchema>): Promise<unknown>;
  listMaterials(userProfileId: string): Promise<unknown>;
  getMaterial(materialId: string): Promise<unknown | null>;
  updateMaterial(input: { materialId: string } & z.infer<typeof UpdateMaterialSchema>): Promise<unknown>;
  deleteMaterial(materialId: string): Promise<void>;
  updateReadingParts(input: { materialId: string; readingPartCount: number }): Promise<unknown>;
  suggestReadingParts(materialId: string, provider?: AiProvider): Promise<{ readingPartCount: number }>;
  generateSimplifications(input: z.infer<typeof GenerateSimplificationsSchema> & { materialId: string }): Promise<unknown>;
  generateChunkSimplifications(input: z.infer<typeof GenerateSimplificationsSchema> & { materialId: string; chunkId: string }): Promise<unknown>;
  saveContextExplanation(input: { chunkId: string; materialId: string; explanation: string }): Promise<void>;
  generateKeyTerms(input: { chunkId: string; materialId: string; text?: string; provider?: AiProvider; force?: boolean }): Promise<unknown>;
  submitParaphraseAttempt(input: { materialId: string } & z.infer<typeof SubmitAttemptSchema>): Promise<unknown>;
}

export function createMaterialRouter(service: MaterialServiceLike = materialService) {
  const router = Router();

  router.post('/extract-file', upload.single('file'), async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      let text: string;

      if (file.mimetype === 'application/pdf') {
        text = await extractHtmlFromPdf(file.buffer);
        if (text.length < 20) {
          // No selectable text — PDF is image-based. Send to Qwen VL for HTML extraction.
          text = await extractTextFromScannedPdf(file.buffer);
        }
        if (text.length < 20) {
          res.status(422).json({ error: 'No readable text could be found in this PDF, even after AI analysis. The document may be blank or in an unsupported format.' });
          return;
        }
      } else if (ACCEPTED_IMAGE_TYPES.has(file.mimetype)) {
        const imageBase64 = file.buffer.toString('base64');
        text = await aiTeachingService.extractTextFromImage({ provider: 'qwen', imageBase64, mimeType: file.mimetype });
      } else {
        res.status(400).json({ error: `Unsupported file type: ${file.mimetype}. Upload a PDF or image.` });
        return;
      }

      res.json({ text });
    } catch (error) {
      if (error instanceof AiProviderError) {
        const friendly = friendlyProviderError(error);
        res.status(503).json({ error: friendly });
        return;
      }
      next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const userProfileId = z.string().min(1).safeParse(req.query.userProfileId);
      if (!userProfileId.success) {
        res.status(400).json({ error: 'userProfileId is required' });
        return;
      }

      const materials = await service.listMaterials(userProfileId.data);
      res.json(materials);
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const parsed = CreateMaterialSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid material input' });
        return;
      }

      const material = await service.createMaterial(parsed.data);
      res.status(201).json(material);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:materialId', async (req, res, next) => {
    try {
      const material = await service.getMaterial(req.params.materialId);
      if (!material) {
        res.status(404).json({ error: 'Material not found' });
        return;
      }

      res.json(material);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:materialId', async (req, res, next) => {
    try {
      const parsed = UpdateMaterialSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid material input' });
        return;
      }

      const material = await service.updateMaterial({
        materialId: req.params.materialId,
        ...parsed.data
      });
      res.json(material);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:materialId', async (req, res, next) => {
    try {
      await service.deleteMaterial(req.params.materialId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:materialId/reading-parts', async (req, res, next) => {
    try {
      const parsed = UpdateReadingPartsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid reading parts input' });
        return;
      }

      const material = await service.updateReadingParts({
        materialId: req.params.materialId,
        readingPartCount: parsed.data.readingPartCount
      });
      res.json(material);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:materialId/reading-parts/suggestion', async (req, res, next) => {
    try {
      const parsed = SuggestReadingPartsSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid reading part suggestion input' });
        return;
      }

      const suggestion = await service.suggestReadingParts(req.params.materialId, parsed.data.provider);
      res.json(suggestion);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:materialId/simplifications', async (req, res, next) => {
    try {
      const parsed = GenerateSimplificationsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid simplifications input' });
        return;
      }

      const result = await service.generateSimplifications({
        materialId: req.params.materialId,
        ...parsed.data
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:materialId/chunks/:chunkId/simplifications', async (req, res, next) => {
    try {
      const parsed = GenerateSimplificationsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid simplifications input' });
        return;
      }

      const result = await service.generateChunkSimplifications({
        materialId: req.params.materialId,
        chunkId: req.params.chunkId,
        ...parsed.data
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:materialId/chunks/:chunkId/context-explanation', async (req, res, next) => {
    try {
      const parsed = SaveContextExplanationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid context explanation input' });
        return;
      }

      await service.saveContextExplanation({
        materialId: req.params.materialId,
        chunkId: req.params.chunkId,
        explanation: parsed.data.explanation
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/:materialId/chunks/:chunkId/key-terms', async (req, res, next) => {
    try {
      const parsed = z.object({
        provider: z.enum(['qwen', 'deepseek', 'openai']).default('qwen'),
        force: z.boolean().optional(),
        text: z.string().min(1).optional()
      }).safeParse(req.body ?? {});
      const provider = parsed.success ? parsed.data.provider : 'qwen';
      const force = parsed.success ? parsed.data.force : false;
      const text = parsed.success ? parsed.data.text : undefined;
      const result = await service.generateKeyTerms({
        materialId: req.params.materialId,
        chunkId: req.params.chunkId,
        provider,
        force,
        text
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:materialId/attempts', async (req, res, next) => {
    try {
      const parsed = SubmitAttemptSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid paraphrase attempt input' });
        return;
      }

      const result = await service.submitParaphraseAttempt({
        materialId: req.params.materialId,
        ...parsed.data
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
