import { createRequire } from 'module';
import multer from 'multer';
import { Router } from 'express';

const require = createRequire(import.meta.url);
// pdf-parse is CommonJS — must be loaded via require in this ESM context
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
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

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text.trim();
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

export interface MaterialServiceLike {
  createMaterial(input: z.infer<typeof CreateMaterialSchema>): Promise<unknown>;
  listMaterials(userProfileId: string): Promise<unknown>;
  getMaterial(materialId: string): Promise<unknown | null>;
  updateMaterial(input: { materialId: string } & z.infer<typeof UpdateMaterialSchema>): Promise<unknown>;
  deleteMaterial(materialId: string): Promise<void>;
  updateReadingParts(input: { materialId: string; readingPartCount: number }): Promise<unknown>;
  suggestReadingParts(materialId: string, provider?: AiProvider): Promise<{ readingPartCount: number }>;
  generateSimplifications(input: z.infer<typeof GenerateSimplificationsSchema> & { materialId: string }): Promise<unknown>;
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
        text = await extractTextFromPdf(file.buffer);
        if (text.length < 20) {
          // No selectable text — PDF is image-based. Send to Qwen VL.
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
