import type { AiCapability, AiProvider, AiRoutingPreferences } from '@ai-teacher/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001';

export interface ProfileResponse {
  chunkMasteryThreshold: number;
  finalSummaryMasteryThreshold: number;
  routingPreferences: AiRoutingPreferences;
}

async function apiRequest(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, options);
}

export async function getProfile(userProfileId: string): Promise<ProfileResponse> {
  const response = await apiRequest(`/profile/${userProfileId}`);
  if (!response.ok) throw new Error('Unable to load profile.');
  return response.json() as Promise<ProfileResponse>;
}

export async function updateThresholds(
  userProfileId: string,
  input: { chunkMasteryThreshold: number; finalSummaryMasteryThreshold: number }
): Promise<void> {
  const response = await apiRequest(`/profile/${userProfileId}/thresholds`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error('Unable to save thresholds.');
}

export async function upsertRoutingPreference(
  userProfileId: string,
  capability: AiCapability,
  provider: AiProvider
): Promise<void> {
  const response = await apiRequest(`/profile/${userProfileId}/routing/${capability}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider })
  });
  if (!response.ok) throw new Error(`Unable to save routing preference for ${capability}.`);
}

export async function updateAllRoutingPreferences(
  userProfileId: string,
  preferences: AiRoutingPreferences
): Promise<void> {
  await Promise.all(
    (Object.entries(preferences) as [AiCapability, AiProvider][]).map(
      ([capability, provider]) => upsertRoutingPreference(userProfileId, capability, provider)
    )
  );
}
