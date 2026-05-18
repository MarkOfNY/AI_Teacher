import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LessonReader } from './LessonReader';

const chunks = [
  { id: 'c1', materialId: 'm1', index: 0, text: 'First chunk has liberty.', status: 'notStarted' as const, bestScore: null },
  { id: 'c2', materialId: 'm1', index: 1, text: 'Second chunk has equality.', status: 'notStarted' as const, bestScore: null }
];

describe('LessonReader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows reading parts with inline reading level buttons including Original', () => {
    render(<LessonReader title="History" chunks={chunks} />);

    expect(screen.getByRole('region', { name: 'Reading Parts' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Full Text' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Reading level' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Very Simple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intermediate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Original' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Middle School' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Standard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('lets the student change reading levels by clicking the level buttons', async () => {
    render(<LessonReader title="History" chunks={chunks} />);

    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Intermediate' }));

    expect(screen.getByRole('button', { name: 'Intermediate' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('dialog', { name: 'Processing lesson changes' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Processing lesson changes' })).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Simple' }));

    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows pre-generated simplified versions with ← → navigation arrows', () => {
    const chunksWithSimplifications = [
      {
        ...chunks[0],
        simplifications: {
          simple: ['First simplified version.', 'Second simplified version.', 'Third version.']
        }
      },
      chunks[1]
    ];
    render(<LessonReader title="History" chunks={chunksWithSimplifications} />);

    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));

    expect(part.getByRole('button', { name: 'First' })).toBeInTheDocument();
    expect(part.getByText('1 of 3')).toBeInTheDocument();
    expect(part.getByRole('button', { name: 'Previous version' })).toBeDisabled();
    expect(part.getByRole('button', { name: 'Next version' })).not.toBeDisabled();
  });

  it('navigates through simplified versions with arrow buttons', async () => {
    const chunksWithSimplifications = [
      {
        ...chunks[0],
        simplifications: {
          simple: ['First simplified version.', 'Second simplified version.']
        }
      },
      chunks[1]
    ];
    render(<LessonReader title="History" chunks={chunksWithSimplifications} />);

    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));

    expect(part.getByRole('button', { name: 'First' })).toBeInTheDocument();

    await userEvent.click(part.getByRole('button', { name: 'Next version' }));

    expect(part.getByRole('button', { name: 'Second' })).toBeInTheDocument();
    expect(part.getByText('2 of 2')).toBeInTheDocument();
    expect(part.getByRole('button', { name: 'Next version' })).toBeDisabled();
  });

  it('shows original text when Original reading level is selected', async () => {
    const chunksWithSimplifications = [
      {
        ...chunks[0],
        simplifications: { simple: ['Simplified text here.'] }
      },
      chunks[1]
    ];
    render(<LessonReader title="History" chunks={chunksWithSimplifications} />);

    await userEvent.click(screen.getByRole('button', { name: 'Original' }));

    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));
    expect(part.getByRole('button', { name: 'liberty' })).toBeInTheDocument();
    expect(part.queryByText('Simplified text here.')).not.toBeInTheDocument();
  });

  it('shows a page-level processing overlay and blocks controls for whole-reader work', () => {
    render(
      <LessonReader
        title="History"
        chunks={chunks}
        isReaderProcessing
      />
    );

    expect(screen.getByRole('dialog', { name: 'Processing lesson changes' })).toHaveTextContent('Processing...');
    expect(screen.getByRole('region', { name: 'Lesson reader content' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Suggest Reading Parts' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Intermediate' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Test Reading Part 1' })).toBeDisabled();
  });

  it('reads the current reading part aloud and stops when clicked again', async () => {
    const pause = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' }))
    }));
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:test'), revokeObjectURL: vi.fn() });
    vi.stubGlobal('Audio', vi.fn().mockImplementation(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      pause,
      onended: null,
      onerror: null,
    })));

    render(<LessonReader title="History" chunks={chunks} />);

    await userEvent.click(screen.getByRole('button', { name: 'Read Reading Part 1 aloud' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop reading Reading Part 1' })).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('First%20chunk%20has%20liberty'));

    await userEvent.click(screen.getByRole('button', { name: 'Stop reading Reading Part 1' }));

    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Read Reading Part 1 aloud' })).toBeInTheDocument();
  });

  it('opens context explanation popover when no context is loaded, requesting from AI', async () => {
    const explainContext = vi.fn();
    render(
      <LessonReader
        title="History"
        chunks={chunks}
        onExplainContext={explainContext}
      />
    );
    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));

    await userEvent.click(part.getByRole('button', { name: 'Explain Reading Part 1' }));

    expect(explainContext).toHaveBeenCalledWith({ chunkId: 'c1', text: 'First chunk has liberty.' });
    expect(part.getByRole('dialog', { name: 'Context explanation for Reading Part 1' })).toBeInTheDocument();
  });

  it('shows pre-loaded context text in popover without re-requesting', async () => {
    const explainContext = vi.fn();
    render(
      <div>
        <button type="button">Outside target</button>
        <LessonReader
          title="History"
          chunks={chunks}
          contextTexts={{ c1: 'This part gives the main legal context.' }}
          onExplainContext={explainContext}
        />
      </div>
    );
    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));

    await userEvent.click(part.getByRole('button', { name: 'Explain Reading Part 1' }));

    expect(explainContext).not.toHaveBeenCalled();
    expect(part.getByRole('dialog', { name: 'Context explanation for Reading Part 1' })).toHaveTextContent('legal context');

    await userEvent.click(part.getByRole('button', { name: 'Close explanation for Reading Part 1' }));
    expect(part.queryByRole('dialog', { name: 'Context explanation for Reading Part 1' })).not.toBeInTheDocument();

    await userEvent.click(part.getByRole('button', { name: 'Explain Reading Part 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Outside target' }));

    expect(part.queryByRole('dialog', { name: 'Context explanation for Reading Part 1' })).not.toBeInTheDocument();
  });

  it('disables explain while a reading part is in test mode', async () => {
    render(<LessonReader title="History" chunks={chunks} />);
    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));

    await userEvent.click(part.getByRole('button', { name: 'Test Reading Part 1' }));

    expect(part.getByRole('button', { name: 'Explain Reading Part 1' })).toBeDisabled();
  });

  it.skip('disables explain on locked reading parts', () => {
    render(<LessonReader title="History" chunks={chunks} />);
    const lockedPart = within(screen.getByRole('article', { name: 'Reading Part 2' }));

    expect(lockedPart.getByRole('button', { name: 'Explain Reading Part 2' })).toBeDisabled();
  });

  it('opens a phrase help popover that can define a word', async () => {
    const defineVocabulary = vi.fn();
    render(
      <LessonReader
        title="History"
        chunks={chunks}
        onDefineVocabulary={defineVocabulary}
      />
    );

    await userEvent.dblClick(screen.getByRole('button', { name: 'liberty' }));
    await userEvent.click(screen.getByRole('button', { name: 'Define' }));
    await userEvent.click(screen.getByRole('button', { name: 'Expand Left' }));

    expect(defineVocabulary).toHaveBeenCalledWith({
      chunkId: 'c1',
      selectedText: 'liberty',
      contextText: 'First chunk has liberty.'
    });
    expect(screen.queryByRole('button', { name: 'Explain Context' })).not.toBeInTheDocument();
  });

  it('shows definitions in a closeable popover and dismisses it on outside click', async () => {
    render(
      <div>
        <button type="button">Outside target</button>
        <LessonReader
          title="History"
          chunks={chunks}
          definitionTexts={{ c1: 'Liberty means freedom in this reading part.' }}
        />
      </div>
    );
    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));

    expect(part.getByRole('dialog', { name: 'Definition for Reading Part 1' })).toHaveTextContent('Liberty means freedom');

    await userEvent.click(part.getByRole('button', { name: 'Close definition for Reading Part 1' }));
    expect(part.queryByRole('dialog', { name: 'Definition for Reading Part 1' })).not.toBeInTheDocument();

    render(
      <div>
        <button type="button">Another outside target</button>
        <LessonReader
          title="History"
          chunks={chunks}
          definitionTexts={{ c1: 'Liberty means freedom in this reading part.' }}
        />
      </div>
    );
    const nextPart = within(screen.getAllByRole('article', { name: 'Reading Part 1' })[1]);

    await userEvent.click(screen.getByRole('button', { name: 'Another outside target' }));
    expect(nextPart.queryByRole('dialog', { name: 'Definition for Reading Part 1' })).not.toBeInTheDocument();
  });

  it('tests one reading part inline, blurs the text, and shows score graphics', async () => {
    const submit = vi.fn();
    render(
      <LessonReader
        title="History"
        chunks={chunks}
        score={{ score: 85, passed: true, feedback: 'Good enough to continue.' }}
        onSubmitParaphrase={submit}
      />
    );

    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));
    await userEvent.click(part.getByRole('button', { name: 'Test Reading Part 1' }));
    await userEvent.type(part.getByRole('textbox', { name: 'Your summary for Reading Part 1' }), 'It says liberty matters.');
    await userEvent.click(part.getByRole('button', { name: 'Submit Test' }));

    expect(part.getByRole('button', { name: 'First' }).closest('p')).toHaveClass('blurred-reading-text');
    expect(submit).toHaveBeenCalledWith({ chunkId: 'c1', transcript: 'It says liberty matters.' });
    expect(part.getByText((_content, element) => element?.textContent === '85%')).toBeInTheDocument();
    expect(part.getByLabelText('Passing score')).toHaveTextContent('✓');
    expect(part.getByRole('status', { name: 'Test result guidance' })).toHaveTextContent('Nice work');
  });

  it('gently sends the student back to review after a low test score', async () => {
    render(
      <LessonReader
        title="History"
        chunks={chunks}
        score={{ score: 72, passed: false, feedback: 'Add the main idea.' }}
      />
    );

    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));
    await userEvent.click(part.getByRole('button', { name: 'Test Reading Part 1' }));

    expect(part.getByRole('status', { name: 'Test result guidance' })).toHaveTextContent('Not quite yet');
    expect(part.getByRole('status', { name: 'Test result guidance' })).toHaveTextContent('Review Again');
  });

  it('returns from test mode to reviewing the same reading part', async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(<LessonReader title="History" chunks={chunks} />);

    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));
    await userEvent.click(part.getByRole('button', { name: 'Test Reading Part 1' }));

    expect(part.getByRole('textbox', { name: 'Your summary for Reading Part 1' })).toBeInTheDocument();
    expect(part.getByRole('button', { name: 'First' }).closest('p')).toHaveClass('blurred-reading-text');

    await userEvent.click(part.getByRole('button', { name: 'Review Again' }));

    expect(part.queryByRole('textbox', { name: 'Your summary for Reading Part 1' })).not.toBeInTheDocument();
    expect(part.getByRole('button', { name: 'First' }).closest('p')).not.toHaveClass('blurred-reading-text');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('dictates a reading part summary when browser speech recognition is available', async () => {
    type TestRecognition = {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      onresult: null | ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void);
      onend: null | (() => void);
    };
    let recognition = undefined as unknown as TestRecognition;
    const SpeechRecognition = vi.fn().mockImplementation(() => {
      recognition = {
        start: vi.fn(),
        stop: vi.fn(),
        onresult: null,
        onend: null
      };
      return recognition;
    });
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia }
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: SpeechRecognition
    });
    render(<LessonReader title="History" chunks={chunks} />);

    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));
    await userEvent.click(part.getByRole('button', { name: 'Test Reading Part 1' }));
    expect(part.queryByRole('button', { name: 'Mic' })).not.toBeInTheDocument();
    expect(part.getByRole('button', { name: 'Record summary for Reading Part 1' })).toHaveClass('summary-mic-button');

    await userEvent.click(part.getByRole('button', { name: 'Record summary for Reading Part 1' }));
    recognition.onresult?.({ results: [{ 0: { transcript: 'Liberty matters.' } }] });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(recognition.start).toHaveBeenCalled();
    await waitFor(() => {
      expect(part.getByRole('textbox', { name: 'Your summary for Reading Part 1' })).toHaveValue('Liberty matters.');
    });
  });

  it('shows an actionable microphone message when browser speech recognition reports a permission error', async () => {
    type TestRecognition = {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      onerror: null | ((event: { error: string }) => void);
      onend: null | (() => void);
    };
    let recognition = undefined as unknown as TestRecognition;
    const SpeechRecognition = vi.fn().mockImplementation(() => {
      recognition = {
        start: vi.fn(),
        stop: vi.fn(),
        onerror: null,
        onend: null
      };
      return recognition;
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: SpeechRecognition
    });
    render(<LessonReader title="History" chunks={chunks} />);

    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));
    await userEvent.click(part.getByRole('button', { name: 'Test Reading Part 1' }));
    await userEvent.click(part.getByRole('button', { name: 'Record summary for Reading Part 1' }));
    recognition.onerror?.({ error: 'not-allowed' });

    expect(await part.findByRole('status')).toHaveTextContent('Allow microphone access');
  });

  it('prevents pasting into a reading part summary', async () => {
    render(<LessonReader title="History" chunks={chunks} />);

    const part = within(screen.getByRole('article', { name: 'Reading Part 1' }));
    await userEvent.click(part.getByRole('button', { name: 'Test Reading Part 1' }));
    const summary = part.getByRole('textbox', { name: 'Your summary for Reading Part 1' });
    const pasteEvent = fireEvent.paste(summary, {
      clipboardData: { getData: () => 'copied summary' }
    });

    expect(pasteEvent).toBe(false);
    expect(summary).toHaveValue('');
  });

  it.skip('locks the next reading part until the current one reaches 80 percent', async () => {
    render(<LessonReader title="History" chunks={chunks} />);

    expect(screen.getByRole('article', { name: 'Reading Part 2' })).toHaveAttribute('data-locked', 'true');
    expect(screen.getByRole('button', { name: 'Test Reading Part 2' })).toBeDisabled();
  });

  it('unlocks the whole-text test after all reading parts have passing scores', async () => {
    const submitFinal = vi.fn();
    render(
      <LessonReader
        title="History"
        chunks={[
          { ...chunks[0], status: 'mastered' as const, bestScore: 82 },
          { ...chunks[1], status: 'mastered' as const, bestScore: 91 }
        ]}
        onSubmitFinalSummary={submitFinal}
      />
    );

    await userEvent.type(screen.getByRole('textbox', { name: 'Whole text summary' }), 'Both parts explain rights.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit Whole Text Test' }));

    expect(submitFinal).toHaveBeenCalledWith('Both parts explain rights.');
  });
});
