import type { ReadingLevel } from '@ai-teacher/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001';

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface MaterialChunkResponse {
  id: string;
  materialId: string;
  index: number;
  text: string;
  status: 'notStarted' | 'inProgress' | 'mastered';
  bestScore: number | null;
  simplifications?: Partial<Record<ReadingLevel, string[]>>;
  contextExplanation?: string | null;
  keyTerms?: KeyTerm[];
}

export interface UserSession {
  user: {
    id: string;
    displayName: string;
  };
}

export interface CreateMaterialRequest {
  userProfileId: string;
  title: string;
  originalText: string;
}

export interface UpdateMaterialRequest {
  materialId: string;
  title: string;
  originalText: string;
}

export interface MaterialSummaryResponse {
  id: string;
  title: string;
  status: string;
  finalBestScore: number | null;
}

export interface MaterialDetailResponse extends MaterialSummaryResponse {
  originalText: string;
  chunks: MaterialChunkResponse[];
}

export interface UpdateReadingPartsRequest {
  materialId: string;
  readingPartCount: number;
}

export interface SubmitParaphraseAttemptRequest {
  materialId: string;
  scope: 'chunk' | 'final';
  chunkId?: string;
  transcript: string;
  referenceText?: string;
}

export interface ScoreResponse {
  score: number;
  passed: boolean;
  feedback: string;
  understood?: string[];
  missed?: string[];
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function createUserSession() {
  const response = await fetch(`${API_BASE_URL}/dev-session`, { method: 'POST' });
  return parseJsonResponse<UserSession>(response, 'Unable to start a session.');
}

export async function createMaterial(input: CreateMaterialRequest) {
  const response = await fetch(`${API_BASE_URL}/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  return parseJsonResponse<MaterialSummaryResponse>(response, 'Unable to create material.');
}

export async function listMaterials(userProfileId: string) {
  const query = new URLSearchParams({ userProfileId });
  const response = await fetch(`${API_BASE_URL}/materials?${query.toString()}`);
  return parseJsonResponse<MaterialSummaryResponse[]>(response, 'Unable to load materials.');
}

export async function getMaterial(materialId: string) {
  const response = await fetch(`${API_BASE_URL}/materials/${materialId}`);
  return parseJsonResponse<MaterialDetailResponse>(response, 'Unable to load material.');
}

export async function updateMaterial(input: UpdateMaterialRequest) {
  const response = await fetch(`${API_BASE_URL}/materials/${input.materialId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: input.title, originalText: input.originalText })
  });

  return parseJsonResponse<MaterialDetailResponse>(response, 'Unable to update material.');
}

export async function deleteMaterial(materialId: string) {
  const response = await fetch(`${API_BASE_URL}/materials/${materialId}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Unable to delete material.');
  }
}

export async function updateReadingParts(input: UpdateReadingPartsRequest) {
  const response = await fetch(`${API_BASE_URL}/materials/${input.materialId}/reading-parts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readingPartCount: input.readingPartCount })
  });

  return parseJsonResponse<MaterialDetailResponse>(response, 'Unable to update reading parts.');
}

export async function suggestReadingParts(materialId: string) {
  const response = await fetch(`${API_BASE_URL}/materials/${materialId}/reading-parts/suggestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'qwen' })
  });

  return parseJsonResponse<{ readingPartCount: number }>(response, 'Unable to suggest reading parts.');
}

export async function extractFile(file: File): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/materials/extract-file`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? 'Unable to extract text from file.');
  }
  return response.json() as Promise<{ text: string }>;
}

export async function generateSimplifications(materialId: string, readingLevel: Exclude<ReadingLevel, 'original'>, provider = 'qwen') {
  const response = await fetch(`${API_BASE_URL}/materials/${materialId}/simplifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readingLevel, provider })
  });
  if (!response.ok) throw new Error('Unable to generate simplifications.');
  return response.json() as Promise<MaterialDetailResponse>;
}

export interface ChunkSimplificationsResponse {
  id: string;
  simplifications: Partial<Record<ReadingLevel, string[]>>;
}

export async function generateChunkSimplifications(materialId: string, chunkId: string, readingLevel: Exclude<ReadingLevel, 'original'>, provider = 'qwen') {
  const response = await fetch(`${API_BASE_URL}/materials/${materialId}/chunks/${chunkId}/simplifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readingLevel, provider })
  });
  if (!response.ok) throw new Error('Unable to generate chunk simplifications.');
  return response.json() as Promise<ChunkSimplificationsResponse>;
}

export async function saveContextExplanation(materialId: string, chunkId: string, explanation: string): Promise<void> {
  await fetch(`${API_BASE_URL}/materials/${materialId}/chunks/${chunkId}/context-explanation`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ explanation })
  });
}

export async function generateKeyTerms(materialId: string, chunkId: string, text?: string): Promise<{ id: string; keyTerms: KeyTerm[] }> {
  const response = await fetch(`${API_BASE_URL}/materials/${materialId}/chunks/${chunkId}/key-terms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'qwen', ...(text ? { text } : {}) })
  });
  if (!response.ok) throw new Error('Unable to generate key terms.');
  return response.json() as Promise<{ id: string; keyTerms: KeyTerm[] }>;
}

export async function submitParaphraseAttempt(input: SubmitParaphraseAttemptRequest) {
  const response = await fetch(`${API_BASE_URL}/materials/${input.materialId}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chunkId: input.chunkId,
      scope: input.scope,
      transcript: input.transcript,
      referenceText: input.referenceText
    })
  });

  return parseJsonResponse<ScoreResponse>(response, 'Unable to score paraphrase.');
}
