import type { AiCapability, AiProvider, AiRoutingPreferences } from '@ai-teacher/shared';
import { DEFAULT_ROUTING_PREFERENCES, isAiCapability } from '@ai-teacher/shared';
import { prisma } from '../db/prisma';

export const profileService = {
  async getProfile(studentProfileId: string) {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: { routingPreferences: true }
    });

    if (!profile) throw new Error(`Student profile not found: ${studentProfileId}`);

    const routingPreferences: AiRoutingPreferences = { ...DEFAULT_ROUTING_PREFERENCES };
    for (const pref of profile.routingPreferences) {
      if (isAiCapability(pref.capability)) {
        routingPreferences[pref.capability] = pref.provider as AiProvider;
      }
    }

    return {
      chunkMasteryThreshold: profile.chunkMasteryThreshold,
      finalSummaryMasteryThreshold: profile.finalSummaryMasteryThreshold,
      routingPreferences
    };
  },

  async updateThresholds(input: {
    studentProfileId: string;
    chunkMasteryThreshold: number;
    finalSummaryMasteryThreshold: number;
  }) {
    await prisma.studentProfile.update({
      where: { id: input.studentProfileId },
      data: {
        chunkMasteryThreshold: input.chunkMasteryThreshold,
        finalSummaryMasteryThreshold: input.finalSummaryMasteryThreshold
      }
    });
  },

  async upsertRoutingPreference(input: {
    studentProfileId: string;
    capability: AiCapability;
    provider: AiProvider;
  }) {
    await prisma.aiRoutingPreference.upsert({
      where: {
        studentProfileId_capability: {
          studentProfileId: input.studentProfileId,
          capability: input.capability
        }
      },
      update: { provider: input.provider },
      create: {
        studentProfileId: input.studentProfileId,
        capability: input.capability,
        provider: input.provider
      }
    });
  }
};
