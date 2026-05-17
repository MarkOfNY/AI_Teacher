const CLASSROOM_BASE = 'https://classroom.googleapis.com/v1';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

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

async function googleGet(url: string, token: string): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let message = `Google API error ${res.status}`;
    try {
      const body = await res.json() as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch { /* ignore parse errors */ }
    throw new Error(message);
  }
  return res;
}

export async function listCourses(token: string): Promise<GoogleCourse[]> {
  const res = await googleGet(
    `${CLASSROOM_BASE}/courses?studentId=me&courseStates=ACTIVE&pageSize=20`,
    token
  );
  const data = await res.json() as { courses?: GoogleCourse[] };
  return data.courses ?? [];
}

export async function listAssignments(token: string, courseId: string): Promise<GoogleAssignment[]> {
  const res = await googleGet(
    `${CLASSROOM_BASE}/courses/${courseId}/courseWork?orderBy=updateTime+desc&pageSize=30`,
    token
  );
  const data = await res.json() as {
    courseWork?: Array<{
      id: string;
      title: string;
      description?: string;
      state?: string;
      materials?: Array<{ driveFile?: { driveFile?: { id: string } } }>;
    }>;
  };

  return (data.courseWork ?? [])
    .filter((cw) => cw.state === 'PUBLISHED')
    .map((cw) => ({
      id: cw.id,
      title: cw.title,
      description: cw.description,
      hasDriveAttachment: Boolean(cw.materials?.some((m) => m.driveFile?.driveFile?.id))
    }));
}

export async function importAssignment(
  token: string,
  courseId: string,
  courseWorkId: string
): Promise<{ text: string; title: string }> {
  const cwRes = await googleGet(
    `${CLASSROOM_BASE}/courses/${courseId}/courseWork/${courseWorkId}`,
    token
  );
  const cw = await cwRes.json() as {
    title: string;
    description?: string;
    materials?: Array<{ driveFile?: { driveFile?: { id: string; title: string } } }>;
  };

  const driveMaterial = cw.materials?.find((m) => m.driveFile?.driveFile?.id);

  if (driveMaterial?.driveFile?.driveFile?.id) {
    const fileId = driveMaterial.driveFile.driveFile.id;

    // Check file type before attempting export
    const metaRes = await googleGet(
      `${DRIVE_BASE}/files/${fileId}?fields=mimeType%2Cname`,
      token
    );
    const meta = await metaRes.json() as { mimeType: string; name: string };

    if (meta.mimeType === 'application/vnd.google-apps.document') {
      const exportRes = await googleGet(
        `${DRIVE_BASE}/files/${fileId}/export?mimeType=text%2Fplain`,
        token
      );
      const text = await exportRes.text();
      if (!text.trim()) throw new Error('The Google Doc appears to be empty.');
      return { text: text.trim(), title: cw.title };
    }

    if (meta.mimeType === 'application/pdf') {
      throw new Error(
        'PDF attachments cannot be imported directly from Classroom. ' +
        'Download the file and use the upload zone instead.'
      );
    }

    throw new Error(
      `"${meta.name}" (${meta.mimeType}) cannot be imported directly. ` +
      'Download it and use the upload zone.'
    );
  }

  // No Drive attachment — use the assignment description if present
  if (cw.description?.trim()) {
    return { text: cw.description.trim(), title: cw.title };
  }

  throw new Error(
    'This assignment has no importable text. It may have no description and only non-document attachments.'
  );
}
