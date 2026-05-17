import { Router } from 'express';
import { z } from 'zod';
import type { AiProvider } from '@ai-teacher/shared';
import { AI_PROVIDERS, isAiCapability } from '@ai-teacher/shared';
import { profileService } from './profileService';

const ThresholdsSchema = z.object({
  chunkMasteryThreshold: z.number().int().min(0).max(100),
  finalSummaryMasteryThreshold: z.number().int().min(0).max(100)
});

const RoutingPreferenceSchema = z.object({
  provider: z.enum([...AI_PROVIDERS] as [AiProvider, ...AiProvider[]])
});

export function createProfileRouter() {
  const router = Router();

  router.get('/:userProfileId', async (req, res, next) => {
    try {
      const profile = await profileService.getProfile(req.params.userProfileId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:userProfileId/thresholds', async (req, res, next) => {
    try {
      const parsed = ThresholdsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid threshold values' });
        return;
      }
      await profileService.updateThresholds({ userProfileId: req.params.userProfileId, ...parsed.data });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.put('/:userProfileId/routing/:capability', async (req, res, next) => {
    try {
      if (!isAiCapability(req.params.capability)) {
        res.status(400).json({ error: `Unknown capability: ${req.params.capability}` });
        return;
      }
      const parsed = RoutingPreferenceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid provider' });
        return;
      }
      await profileService.upsertRoutingPreference({
        userProfileId: req.params.userProfileId,
        capability: req.params.capability,
        provider: parsed.data.provider
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
