import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const materialsApi = vi.hoisted(() => ({
  createDevSession: vi.fn(),
  createMaterial: vi.fn(),
  deleteMaterial: vi.fn(),
  getMaterial: vi.fn(),
  listMaterials: vi.fn(),
  submitParaphraseAttempt: vi.fn(),
  suggestReadingParts: vi.fn(),
  updateMaterial: vi.fn(),
  updateReadingParts: vi.fn(),
}));

const aiApi = vi.hoisted(() => ({
  defineVocabulary: vi.fn(),
  simplifyText: vi.fn(),
  explainContext: vi.fn(),
  explainGaps: vi.fn(),
}));

const googleOAuth = vi.hoisted(() => ({
  login: vi.fn(),
  options: null as null | { onSuccess: (tokenResponse: { access_token?: string }) => void },
}));

vi.mock('../api/materialsClient', () => materialsApi);
vi.mock('../api/aiClient', () => aiApi);

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGoogleLogin: (options: { onSuccess: (tokenResponse: { access_token?: string }) => void }) => {
    googleOAuth.options = options;
    return googleOAuth.login;
  },
}));

describe('App', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn()
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
  });

  afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    materialsApi.createDevSession.mockReset();
    materialsApi.createMaterial.mockReset();
    materialsApi.deleteMaterial.mockReset();
    materialsApi.getMaterial.mockReset();
    materialsApi.listMaterials.mockReset();
    materialsApi.submitParaphraseAttempt.mockReset();
    materialsApi.suggestReadingParts.mockReset();
    materialsApi.updateMaterial.mockReset();
    materialsApi.updateReadingParts.mockReset();
    aiApi.simplifyText.mockReset();
    aiApi.defineVocabulary.mockReset();
    aiApi.explainContext.mockReset();
    aiApi.explainGaps.mockReset();
    googleOAuth.login.mockClear();
    googleOAuth.options = null;
  });

  function mockSession() {
    materialsApi.createDevSession.mockResolvedValue({
      parent: { id: 'parent_1', displayName: 'Parent' },
      student: { id: 'student_1', displayName: 'Student' },
    });
    materialsApi.listMaterials.mockResolvedValue([]);
  }

  async function openSavedLesson() {
    const lessonPicker = await screen.findByLabelText('Choose lesson');
    await waitFor(() => {
      expect(within(lessonPicker).getByRole('option', { name: 'Saved Lesson' })).toBeInTheDocument();
    });
    await userEvent.selectOptions(lessonPicker, 'material_1');
  }

  it('shows a parent dashboard after Google login succeeds', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });

    await waitFor(() => {
      expect(screen.getByText('Parent Workspace')).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Take Lesson' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: 'Choose lesson' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create Lesson' })).not.toBeInTheDocument();
  });

  it('keeps lesson management in a separate section from the lesson reader', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await screen.findByText('Parent Workspace');

    await userEvent.click(screen.getByRole('tab', { name: 'Manage Lessons' }));

    expect(screen.getByRole('heading', { name: 'Create Lesson' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'Manage Lessons' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Saved Lesson' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete Saved Lesson' })).toBeEnabled();
    expect(screen.queryByRole('combobox', { name: 'Choose lesson' })).not.toBeInTheDocument();
  });

  it('adds a created lesson to the student materials list', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.createMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Declaration of Independence',
      status: 'notStarted',
      finalBestScore: null,
    });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });

    await screen.findByText('Parent Workspace');
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Lessons' }));
    await userEvent.type(screen.getByLabelText('Title'), 'Declaration of Independence');
    await userEvent.type(screen.getByLabelText('Material text'), 'When in the Course of human events...');
    await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }));

    await waitFor(() => {
      expect(materialsApi.createMaterial).toHaveBeenCalledWith({
        studentProfileId: 'student_1',
        title: 'Declaration of Independence',
        originalText: 'When in the Course of human events...',
      });
    });
    expect(await screen.findByText('Declaration of Independence')).toBeInTheDocument();
    expect(screen.queryByText('No materials yet')).not.toBeInTheDocument();
  });

  it('edits a saved lesson from Manage Lessons', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'Original lesson text.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [],
    });
    materialsApi.updateMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Updated Lesson',
      originalText: 'Original lesson text.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [],
    });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await screen.findByText('Parent Workspace');
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Lessons' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Saved Lesson' }));
    await screen.findByRole('heading', { name: 'Edit Lesson' });
    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Updated Lesson');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(materialsApi.updateMaterial).toHaveBeenCalledWith({
      materialId: 'material_1',
      title: 'Updated Lesson',
      originalText: 'Original lesson text.',
    });
    expect(await screen.findByText('Updated Lesson')).toBeInTheDocument();
  });

  it('deletes a saved lesson from Manage Lessons after confirmation', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    const confirm = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: confirm
    });
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.deleteMaterial.mockResolvedValue(undefined);
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await screen.findByText('Parent Workspace');
    await userEvent.click(screen.getByRole('tab', { name: 'Manage Lessons' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Saved Lesson' }));

    expect(confirm).toHaveBeenCalledWith('Delete "Saved Lesson"? This cannot be undone.');
    expect(materialsApi.deleteMaterial).toHaveBeenCalledWith('material_1');
    await waitFor(() => {
      expect(screen.queryByText('Saved Lesson')).not.toBeInTheDocument();
    });
  });

  it('opens a saved material in the lesson reader', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'First chunk.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'First chunk.', status: 'notStarted', bestScore: null },
      ],
    });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });

    await openSavedLesson();

    expect(await screen.findByRole('heading', { name: 'Saved Lesson' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Reading Part 1' })).toBeInTheDocument();
  });

  it('jumps to the top and shows loading progress while opening a material', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollTo
    });
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    let resolveMaterial: (value: unknown) => void = () => undefined;
    materialsApi.getMaterial.mockReturnValue(new Promise((resolve) => {
      resolveMaterial = resolve;
    }));
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(screen.getByRole('progressbar', { name: 'Loading lesson' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading lesson...');

    resolveMaterial({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'First chunk.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'First chunk.', status: 'notStarted', bestScore: null },
      ],
    });

    expect(await screen.findByRole('heading', { name: 'Saved Lesson' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('progressbar', { name: 'Loading lesson' })).not.toBeInTheDocument();
    });
  });

  it('keeps the loaded reading parts when AI suggests the same count', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'One. Two. Three.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'One. Two. Three.', status: 'notStarted', bestScore: null },
      ],
    });
    materialsApi.suggestReadingParts.mockResolvedValue({ readingPartCount: 1 });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();

    expect(await screen.findByRole('article', { name: 'Reading Part 1' })).toBeInTheDocument();
    expect(materialsApi.suggestReadingParts).toHaveBeenCalledWith('material_1');
    expect(materialsApi.updateReadingParts).not.toHaveBeenCalled();
  });

  it('uses suggested reading parts when a lesson is selected', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'One. Two. Three.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'One. Two. Three.', status: 'notStarted', bestScore: null },
      ],
    });
    materialsApi.suggestReadingParts.mockResolvedValue({ readingPartCount: 3 });
    materialsApi.updateReadingParts.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'One. Two. Three.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'One.', status: 'notStarted', bestScore: null },
        { id: 'chunk_2', materialId: 'material_1', index: 1, text: 'Two.', status: 'notStarted', bestScore: null },
        { id: 'chunk_3', materialId: 'material_1', index: 2, text: 'Three.', status: 'notStarted', bestScore: null },
      ],
    });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();

    await waitFor(() => {
      expect(materialsApi.updateReadingParts).toHaveBeenCalledWith({
        materialId: 'material_1',
        readingPartCount: 3,
      });
    });
    expect(await screen.findByText('Reading Part 3')).toBeInTheDocument();
  });

  it('repairs legacy materials with too many tiny reading parts when opened', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'A copied text with many short lines.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: Array.from({ length: 41 }, (_unused, index) => ({
        id: `chunk_${index + 1}`,
        materialId: 'material_1',
        index,
        text: `Tiny part ${index + 1}.`,
        status: 'notStarted',
        bestScore: null,
      })),
    });
    materialsApi.suggestReadingParts.mockResolvedValue({ readingPartCount: 4 });
    materialsApi.updateReadingParts.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'A copied text with many short lines.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: Array.from({ length: 4 }, (_unused, index) => ({
        id: `chunk_${index + 1}`,
        materialId: 'material_1',
        index,
        text: `Readable part ${index + 1}.`,
        status: 'notStarted',
        bestScore: null,
      })),
    });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();

    await waitFor(() => {
      expect(materialsApi.updateReadingParts).toHaveBeenCalledWith({
        materialId: 'material_1',
        readingPartCount: 4,
      });
    });
    expect(await screen.findByText('Reading Part 4')).toBeInTheDocument();
  });

  it('repairs legacy materials when a new suggestion creates more smaller reading parts', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'A long copied legal text.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: Array.from({ length: 50 }, (_unused, index) => ({
        id: `chunk_${index + 1}`,
        materialId: 'material_1',
        index,
        text: `Large part ${index + 1}.`,
        status: 'notStarted',
        bestScore: null,
      })),
    });
    materialsApi.suggestReadingParts.mockResolvedValue({ readingPartCount: 80 });
    materialsApi.updateReadingParts.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'A long copied legal text.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: Array.from({ length: 80 }, (_unused, index) => ({
        id: `chunk_${index + 1}`,
        materialId: 'material_1',
        index,
        text: `Smaller part ${index + 1}.`,
        status: 'notStarted',
        bestScore: null,
      })),
    });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();

    await waitFor(() => {
      expect(materialsApi.updateReadingParts).toHaveBeenCalledWith({
        materialId: 'material_1',
        readingPartCount: 80,
      });
    });
    expect(await screen.findByText('Reading Part 80')).toBeInTheDocument();
  });

  it('repairs opened lessons whose reading parts are still too large', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    const largeText = Array.from({ length: 220 }, (_unused, index) => `word${index}`).join(' ');
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: largeText,
      status: 'notStarted',
      finalBestScore: null,
      chunks: Array.from({ length: 20 }, (_unused, index) => ({
        id: `chunk_${index + 1}`,
        materialId: 'material_1',
        index,
        text: largeText,
        status: 'notStarted',
        bestScore: null,
      })),
    });
    materialsApi.suggestReadingParts.mockResolvedValue({ readingPartCount: 90 });
    materialsApi.updateReadingParts.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: largeText,
      status: 'notStarted',
      finalBestScore: null,
      chunks: Array.from({ length: 90 }, (_unused, index) => ({
        id: `chunk_${index + 1}`,
        materialId: 'material_1',
        index,
        text: `Smaller part ${index + 1}.`,
        status: 'notStarted',
        bestScore: null,
      })),
    });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();

    await waitFor(() => {
      expect(materialsApi.updateReadingParts).toHaveBeenCalledWith({
        materialId: 'material_1',
        readingPartCount: 90,
      });
    });
  });

  it('shows the task-specific AI error when simplify fails', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'First chunk.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'First chunk.', status: 'notStarted', bestScore: null },
      ],
    });
    aiApi.simplifyText.mockRejectedValue(new Error('Simplify failed.'));
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();
    await userEvent.click(await screen.findByRole('button', { name: 'Simplified text for Reading Part 1' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Fallback also failed');
    expect(aiApi.simplifyText).toHaveBeenNthCalledWith(1, { text: 'First chunk.', readingLevel: 'simple', provider: 'qwen' });
    expect(aiApi.simplifyText).toHaveBeenNthCalledWith(2, { text: 'First chunk.', readingLevel: 'simple', provider: 'openai' });
  });

  it('uses OpenAI support when DeepSeek fails and OpenAI succeeds', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'First chunk.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'First chunk.', status: 'notStarted', bestScore: null },
      ],
    });
    aiApi.simplifyText
      .mockRejectedValueOnce(new Error('The app is having difficulty completing simplifying this text with DeepSeek.'))
      .mockResolvedValueOnce({ text: 'OpenAI simple text.', provider: 'openai' });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();
    await userEvent.click(await screen.findByRole('button', { name: 'Simplified text for Reading Part 1' }));

    expect(await screen.findByRole('button', { name: 'OpenAI' })).toBeInTheDocument();
  });

  it('stores simplified text inside the matching full-text reading part', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'First part. Second part.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'First part.', status: 'notStarted', bestScore: null },
        { id: 'chunk_2', materialId: 'material_1', index: 1, text: 'Second part.', status: 'notStarted', bestScore: null },
      ],
    });
    aiApi.simplifyText.mockResolvedValue({ text: 'First part in easier words.', provider: 'deepseek' });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();
    await userEvent.click(await screen.findByRole('button', { name: 'Simplified text for Reading Part 1' }));
    const readingPart = within(screen.getByRole('article', { name: 'Reading Part 1' }));

    expect(await readingPart.findByRole('button', { name: 'easier' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Full Text' })).not.toBeInTheDocument();
  });

  it('shows selected-word definitions in the reading part popover', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'First chunk has liberty.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'First chunk has liberty.', status: 'notStarted', bestScore: null },
      ],
    });
    aiApi.defineVocabulary.mockResolvedValue({ definition: 'Liberty means freedom in this reading part.', provider: 'deepseek' });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();
    await userEvent.dblClick(await screen.findByRole('button', { name: 'liberty' }));
    await userEvent.click(screen.getByRole('button', { name: 'Define' }));

    expect(await screen.findByRole('dialog', { name: 'Definition for Reading Part 1' })).toHaveTextContent('Liberty means freedom');
    expect(aiApi.defineVocabulary).toHaveBeenCalledWith({
      term: 'liberty',
      contextText: 'First chunk has liberty.',
      provider: 'qwen'
    });
  });

  it('updates reading parts from the lesson reader controls', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'One. Two. Three.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'One.', status: 'notStarted', bestScore: null },
        { id: 'chunk_2', materialId: 'material_1', index: 1, text: 'Two.', status: 'notStarted', bestScore: null },
      ],
    });
    materialsApi.updateReadingParts.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'One. Two. Three.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'One.', status: 'notStarted', bestScore: null },
        { id: 'chunk_2', materialId: 'material_1', index: 1, text: 'Two.', status: 'notStarted', bestScore: null },
        { id: 'chunk_3', materialId: 'material_1', index: 2, text: 'Three.', status: 'notStarted', bestScore: null },
      ],
    });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();
    await userEvent.selectOptions(await screen.findByLabelText('Number of Reading Parts'), '3');

    await waitFor(() => {
      expect(materialsApi.updateReadingParts).toHaveBeenCalledWith({
        materialId: 'material_1',
        readingPartCount: 3,
      });
    });
    expect(await screen.findByText('Reading Part 3')).toBeInTheDocument();
  });

  it('locks the reader behind a page-level processing dialog while reading parts are updating', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
    mockSession();
    materialsApi.listMaterials.mockResolvedValue([
      { id: 'material_1', title: 'Saved Lesson', status: 'notStarted', finalBestScore: null },
    ]);
    materialsApi.getMaterial.mockResolvedValue({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'One. Two. Three.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'One.', status: 'notStarted', bestScore: null },
        { id: 'chunk_2', materialId: 'material_1', index: 1, text: 'Two.', status: 'notStarted', bestScore: null },
      ],
    });
    let resolveUpdate: (value: unknown) => void = () => undefined;
    materialsApi.updateReadingParts.mockReturnValue(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });
    await openSavedLesson();
    await userEvent.selectOptions(await screen.findByLabelText('Number of Reading Parts'), '3');

    expect(screen.getByRole('dialog', { name: 'Processing lesson changes' })).toHaveTextContent('Processing...');
    expect(screen.getByRole('button', { name: 'Suggest Reading Parts' })).toBeDisabled();

    resolveUpdate({
      id: 'material_1',
      title: 'Saved Lesson',
      originalText: 'One. Two. Three.',
      status: 'notStarted',
      finalBestScore: null,
      chunks: [
        { id: 'chunk_1', materialId: 'material_1', index: 0, text: 'One.', status: 'notStarted', bestScore: null },
        { id: 'chunk_2', materialId: 'material_1', index: 1, text: 'Two.', status: 'notStarted', bestScore: null },
        { id: 'chunk_3', materialId: 'material_1', index: 2, text: 'Three.', status: 'notStarted', bestScore: null },
      ],
    });

    expect(await screen.findByText('Reading Part 3')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Processing lesson changes' })).not.toBeInTheDocument();
  });

  it('supports a development-only QA session for browser testing after login', () => {
    window.history.pushState(null, '', '/?qaSession=parent');
    mockSession();

    render(<App />);

    expect(screen.getByText('Parent Workspace')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Take Lesson' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: 'Choose lesson' })).toBeInTheDocument();
  });

  it('explains how to configure Google login when the client id is missing', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    render(<App />);

    expect(screen.getByRole('button', { name: /login with google/i })).toBeDisabled();
    expect(screen.getByText(/VITE_GOOGLE_CLIENT_ID/)).toBeInTheDocument();
  });
});
