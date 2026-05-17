const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001';

export interface GoogleCourse {
  id: string;
  name: string;
  section?: string;
}

export interface GoogleAssignment {
  id: string;
  title: string;
  description?: string;
  hasDriveAttachment: boolean;
}

async function classroomRequest<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/classroom${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {})
    }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCourses(token: string): Promise<GoogleCourse[]> {
  const data = await classroomRequest<{ courses: GoogleCourse[] }>('/courses', token);
  return data.courses;
}

export async function fetchAssignments(token: string, courseId: string): Promise<GoogleAssignment[]> {
  const data = await classroomRequest<{ assignments: GoogleAssignment[] }>(
    `/courses/${courseId}/assignments`,
    token
  );
  return data.assignments;
}

export async function importFromClassroom(
  token: string,
  courseId: string,
  courseWorkId: string
): Promise<{ text: string; title: string }> {
  return classroomRequest<{ text: string; title: string }>('/import', token, {
    method: 'POST',
    body: JSON.stringify({ courseId, courseWorkId })
  });
}
