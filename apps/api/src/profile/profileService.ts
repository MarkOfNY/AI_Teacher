import type { AiCapability, AiProvider, AiRoutingPreferences } from '@ai-teacher/shared';
import { DEFAULT_ROUTING_PREFERENCES, isAiCapability } from '@ai-teacher/shared';
import { prisma } from '../db/prisma';

export const profileService = {
  async getProfile(userProfileId: string) {
    const profile = await prisma.userProfile.findUnique({
      where: { id: userProfileId },
      include: { routingPreferences: true }
    });

    if (!profile) throw new Error(`User profile not found: ${userProfileId}`);

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
    userProfileId: string;
    chunkMasteryThreshold: number;
    finalSummaryMasteryThreshold: number;
  }) {
    await prisma.userProfile.update({
      where: { id: input.userProfileId },
      data: {
        chunkMasteryThreshold: input.chunkMasteryThreshold,
        finalSummaryMasteryThreshold: input.finalSummaryMasteryThreshold
      }
    });
  },

  async upsertRoutingPreference(input: {
    userProfileId: string;
    capability: AiCapability;
    provider: AiProvider;
  }) {
    await prisma.aiRoutingPreference.upsert({
      where: {
        userProfileId_capability: {
          userProfileId: input.userProfileId,
          capability: input.capability
        }
      },
      update: { provider: input.provider },
      create: {
        userProfileId: input.userProfileId,
        capability: input.capability,
        provider: input.provider
      }
    });
  }
};
