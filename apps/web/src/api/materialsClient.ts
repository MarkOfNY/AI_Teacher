const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001';

export interface MaterialChunkResponse {
  id: string;
  materialId: string;
  index: number;
  text: string;
  status: 'notStarted' | 'inProgress' | 'mastered';
  bestScore: number | null;
}

export interface DevSession {
  parent: {
    id: string;
    displayName: string;
  };
  student: {
    id: string;
    displayName: string;
  };
}

export interface CreateMaterialRequest {
  studentProfileId: string;
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

export async function createDevSession() {
  const response = await fetch(`${API_BASE_URL}/dev-session`, { method: 'POST' });
  return parseJsonResponse<DevSession>(response, 'Unable to start a development session.');
}

export async function createMaterial(input: CreateMaterialRequest) {
  const response = await fetch(`${API_BASE_URL}/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  return parseJsonResponse<MaterialSummaryResponse>(response, 'Unable to create material.');
}

export async function listMaterials(studentProfileId: string) {
  const query = new URLSearchParams({ studentProfileId });
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

export async function submitParaphraseAttempt(input: SubmitParaphraseAttemptRequest) {
  const response = await fetch(`${API_BASE_URL}/materials/${input.materialId}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chunkId: input.chunkId,
      scope: input.scope,
      transcript: input.transcript
    })
  });

  return parseJsonResponse<ScoreResponse>(response, 'Unable to score paraphrase.');
}
