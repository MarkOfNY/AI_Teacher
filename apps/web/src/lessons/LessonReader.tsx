import { useEffect, useRef, useState, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001';
import { ChevronLeft, ChevronRight, Lightbulb, Mic, Square, Volume2, X } from 'lucide-react';
import type { MaterialChunk, ReadingLevel } from '@ai-teacher/shared';
import { SelectableText } from './SelectableText';

interface SpeechRecognitionResultLike {
  0: { transcript: string };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: null | ((event: { results: ArrayLike<SpeechRecognitionResultLike> }) => void);
  onerror: null | ((event: { error?: string }) => void);
  onend: null | (() => void);
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}


const readingLevelOptions: Array<{ value: ReadingLevel; label: string }> = [
  { value: 'verySimple', label: 'Very Simple' },
  { value: 'simple', label: 'Simple' },
  { value: 'middleSchool', label: 'Intermediate' }
];

interface ParaphraseScore {
  score: number;
  passed: boolean;
  feedback: string;
  missed?: string[];
}

interface LessonReaderProps {
  title: string;
  chunks: MaterialChunk[];
  chunkMasteryThreshold?: number;
  initialChunkIndex?: number;
  score?: ParaphraseScore | null;
  finalScore?: ParaphraseScore | null;
  isSubmitting?: boolean;
  isSubmittingFinal?: boolean;
  readingPartCount?: number;
  sentenceCount?: number;
  onSubmitParaphrase?: (input: { chunkId: string; transcript: string; referenceText: string }) => void;
  onSubmitFinalSummary?: (transcript: string) => void;
  onChangeReadingPartCount?: (readingPartCount: number) => void;
  onSuggestReadingParts?: () => void;
  simplifiedTexts?: Record<string, string>;
  contextTexts?: Record<string, string>;
  definitionTexts?: Record<string, string>;
  isSupportLoading?: boolean;
  supportLoadingChunkId?: string | null;
  isReaderProcessing?: boolean;
  simplificationsProgress?: { ready: number; total: number } | null;
  onSimplify?: (input: { chunkId: string; text: string; readingLevel: ReadingLevel }) => void;
  onExplainContext?: (input: { chunkId: string; text: string }) => void;
  onExplainAgain?: (input: { chunkId: string; text: string }) => void;
  onReadingLevelChange?: (level: ReadingLevel) => void;
  onDefineVocabulary?: (input: { chunkId: string; selectedText: string; contextText: string }) => void;
  onFirstAudioCached?: () => void;
}

function scoreTone(score: number, threshold: number) {
  if (score >= 90) return { label: 'Strong passing score', symbol: '\u2713', className: 'score-icon score-icon-green' };
  if (score >= threshold) return { label: 'Passing score', symbol: '\u2713', className: 'score-icon score-icon-yellow' };
  return { label: 'Not passing yet', symbol: '\u00d7', className: 'score-icon score-icon-red' };
}

function isPassed(chunk: MaterialChunk, threshold: number) {
  return (chunk.bestScore ?? 0) >= threshold || chunk.status === 'mastered';
}

function scoreGuidance(score: ParaphraseScore, threshold: number) {
  if (score.score >= 90) {
    return 'Excellent work. You explained this reading part clearly and included the important ideas.';
  }
  if (score.score >= threshold) {
    return 'Nice work. You passed this reading part and can keep going.';
  }
  return 'Not quite yet. Take another look at the reading part, then try again in your own words. Use Review Again when you are ready to go back to the text.';
}

export function LessonReader({
  title,
  chunks,
  chunkMasteryThreshold = 80,
  score = null,
  finalScore = null,
  isSubmitting = false,
  isSubmittingFinal = false,
  readingPartCount,
  sentenceCount,
  onSubmitParaphrase,
  onSubmitFinalSummary,
  onChangeReadingPartCount,
  onSuggestReadingParts,
  simplifiedTexts = {},
  contextTexts = {},
  definitionTexts = {},
  isSupportLoading = false,
  supportLoadingChunkId = null,
  isReaderProcessing = false,
  simplificationsProgress = null,
  onSimplify,
  onExplainContext,
  onExplainAgain,
  onReadingLevelChange,
  onDefineVocabulary,
  onFirstAudioCached
}: LessonReaderProps) {
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>('simple');
  const [simplifiedVisible, setSimplifiedVisible] = useState<Record<string, boolean>>({});
  const [testChunkId, setTestChunkId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const [dictationMessages, setDictationMessages] = useState<Record<string, string>>({});
  const [finalTranscript, setFinalTranscript] = useState('');
  const [openContextChunkId, setOpenContextChunkId] = useState<string | null>(null);
  const [explainVersionIndex, setExplainVersionIndex] = useState<Record<string, number>>({});
  const [dismissedDefinitionTexts, setDismissedDefinitionTexts] = useState<Record<string, string>>({});
  const [isChangingReadingLevel, setIsChangingReadingLevel] = useState(false);
  const [speakingChunkId, setSpeakingChunkId] = useState<string | null>(null);
  const [activeDictationChunkId, setActiveDictationChunkId] = useState<string | null>(null);
  const readingPartRefs = useRef<Record<string, HTMLElement | null>>({});
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const userStoppedRef = useRef(false);
  const contextPopoverRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contextButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const definitionPopoverRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const requestedSimplificationsRef = useRef<Set<string>>(new Set());
  const onFirstAudioCachedRef = useRef(onFirstAudioCached);
  useEffect(() => { onFirstAudioCachedRef.current = onFirstAudioCached; });
  const allChunksPassed = chunks.length > 0 && chunks.every((chunk) => isPassed(chunk, chunkMasteryThreshold));
  const currentReadingPartCount = readingPartCount ?? chunks.length;
  const wholeReaderProcessing = isReaderProcessing || isChangingReadingLevel;
  const maxReadingPartChoice = Math.min(60, Math.max(1, sentenceCount ?? chunks.length));
  const readingPartChoices = Array.from(
    new Set([
      ...Array.from({ length: maxReadingPartChoice }, (_unused, index) => index + 1),
      currentReadingPartCount,
    ])
  ).sort((first, second) => first - second);

  useEffect(() => {
    if (!openContextChunkId) return undefined;
    const openChunkId = openContextChunkId;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      const popover = contextPopoverRefs.current[openChunkId];
      const button = contextButtonRefs.current[openChunkId];
      if (popover?.contains(target) || button?.contains(target)) return;
      setOpenContextChunkId(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openContextChunkId]);

  useEffect(() => () => {
    activeAudioRef.current?.pause();
    audioCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    audioCacheRef.current.clear();
    recognitionRef.current?.stop();
    if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
  }, []);

  useEffect(() => {
    const cache = audioCacheRef.current;
    cache.forEach((url) => URL.revokeObjectURL(url));
    cache.clear();

    if (chunks.length === 0) {
      onFirstAudioCachedRef.current?.();
      return;
    }

    let cancelled = false;
    void (async () => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (cancelled) break;
        try {
          const response = await fetch(`${API_BASE_URL}/tts?text=${encodeURIComponent(chunk.text)}`);
          if (!response.ok || cancelled) {
            if (i === 0 && !cancelled) onFirstAudioCachedRef.current?.();
            break;
          }
          const blob = await response.blob();
          if (!cancelled) {
            cache.set(chunk.text, URL.createObjectURL(blob));
            if (i === 0) onFirstAudioCachedRef.current?.();
          }
        } catch {
          if (i === 0) onFirstAudioCachedRef.current?.();
          // non-fatal — on-demand fetch will handle it if needed
        }
      }
    })();

    return () => { cancelled = true; };
  }, [chunks]);


  useEffect(() => {
    const openChunkIds = chunks
      .map((chunk) => chunk.id)
      .filter((chunkId) => definitionTexts[chunkId] && dismissedDefinitionTexts[chunkId] !== definitionTexts[chunkId]);
    if (openChunkIds.length === 0) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;

      const clickedInsideDefinition = openChunkIds.some((chunkId) => definitionPopoverRefs.current[chunkId]?.contains(target));
      if (clickedInsideDefinition) return;

      setDismissedDefinitionTexts((current) => {
        const next = { ...current };
        openChunkIds.forEach((chunkId) => {
          const definitionText = definitionTexts[chunkId];
          if (definitionText) {
            next[chunkId] = definitionText;
          }
        });
        return next;
      });
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [chunks, definitionTexts, dismissedDefinitionTexts]);

  useEffect(() => {
    if (activeDictationChunkId && testChunkId !== activeDictationChunkId) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setActiveDictationChunkId(null);
    }
  }, [testChunkId, activeDictationChunkId]);

  useEffect(() => {
    if (!onSimplify) return;

    chunks.forEach((chunk) => {
      const hasStored = (chunk.simplifications?.[readingLevel]?.length ?? 0) > 0;
      if (hasStored) return;
      const requestKey = `${chunk.id}:${readingLevel}`;
      if (simplifiedTexts[chunk.id] || requestedSimplificationsRef.current.has(requestKey)) return;
      requestedSimplificationsRef.current.add(requestKey);
      onSimplify({ chunkId: chunk.id, text: chunk.text, readingLevel });
    });
  }, [chunks, onSimplify, readingLevel, simplifiedTexts]);

  useEffect(() => {
    if (!isChangingReadingLevel || isSupportLoading) return;
    const timeout = window.setTimeout(() => setIsChangingReadingLevel(false), 150);
    return () => window.clearTimeout(timeout);
  }, [isChangingReadingLevel, isSupportLoading]);

  function handleReadingLevelChange(nextLevel: ReadingLevel) {
    if (wholeReaderProcessing) return;
    setReadingLevel(nextLevel);
    setIsChangingReadingLevel(true);
    setSimplifiedVisible({});
    setExplainVersionIndex({});
    onReadingLevelChange?.(nextLevel);
  }

  function setReadingPartMode(chunk: MaterialChunk, mode: 'original' | 'simplified') {
    if (wholeReaderProcessing) return;
    if (speakingChunkId === chunk.id || speakingChunkId === `${chunk.id}-explanation`) {
      activeAudioRef.current?.pause();
      activeAudioRef.current = null;
      setSpeakingChunkId(null);
    }
    const hasStoredSimplification = (chunk.simplifications?.[readingLevel]?.length ?? 0) > 0;
    if (mode === 'simplified' && !hasStoredSimplification && !simplifiedTexts[chunk.id]) {
      onSimplify?.({ chunkId: chunk.id, text: chunk.text, readingLevel });
    }
    setSimplifiedVisible((current) => ({ ...current, [chunk.id]: mode === 'simplified' }));
  }

  // TODO: re-enable locking after audio testing is complete
  function isLocked(_index: number) {
    return false;
  }

  function handleContextClick(chunk: MaterialChunk) {
    const isOpening = openContextChunkId !== chunk.id;
    setOpenContextChunkId((currentId) => currentId === chunk.id ? null : chunk.id);
    if (isOpening) {
      const hasStored = (chunk.simplifications?.[readingLevel]?.length ?? 0) > 0;
      if (!hasStored) onExplainContext?.({ chunkId: chunk.id, text: chunk.text });
    }
  }

  function handleReviewAgain(chunk: MaterialChunk) {
    setTestChunkId(null);
    readingPartRefs.current[chunk.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const readTextAloud = useCallback(async (id: string, text: string) => {
    if (speakingChunkId === id) {
      activeAudioRef.current?.pause();
      activeAudioRef.current = null;
      setSpeakingChunkId(null);
      return;
    }

    activeAudioRef.current?.pause();
    activeAudioRef.current = null;

    setSpeakingChunkId(id);
    try {
      let blobUrl = audioCacheRef.current.get(text);
      if (!blobUrl) {
        const response = await fetch(`${API_BASE_URL}/tts?text=${encodeURIComponent(text)}`);
        if (!response.ok) throw new Error('TTS request failed');
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        audioCacheRef.current.set(text, blobUrl);
      }
      const audio = new Audio(blobUrl);
      activeAudioRef.current = audio;
      audio.onended = () => {
        activeAudioRef.current = null;
        setSpeakingChunkId((current) => current === id ? null : current);
      };
      audio.onerror = () => {
        activeAudioRef.current = null;
        setSpeakingChunkId((current) => current === id ? null : current);
      };
      await audio.play();
    } catch {
      setSpeakingChunkId(null);
    }
  }, [speakingChunkId]);

  function dictationErrorMessage(error?: string) {
    if (error === 'not-allowed' || error === 'service-not-allowed') {
      return 'Allow microphone access in the browser, then try Mic again. You can type your summary instead.';
    }
    if (error === 'audio-capture') {
      return 'No microphone was found. Check the microphone connection, or type your summary instead.';
    }
    if (error === 'network') {
      return 'Speech recognition could not reach the browser speech service. You can type your summary instead.';
    }
    if (error === 'no-speech') {
      return 'No speech was heard. Try Mic again and speak clearly, or type your summary instead.';
    }
    return 'Microphone dictation did not work in this browser. You can type your summary instead.';
  }

  async function requestMicrophonePermission() {
    const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
    stream?.getTracks().forEach((track) => track.stop());
  }

  function toggleDictation(chunk: MaterialChunk) {
    function clearSilenceTimer() {
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }

    if (activeDictationChunkId === chunk.id) {
      userStoppedRef.current = true;
      clearSilenceTimer();
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setActiveDictationChunkId(null);
      setDictationMessages((current) => ({
        ...current,
        [chunk.id]: transcripts[chunk.id]?.trim()
          ? 'Recorded. Review it, then submit when ready.'
          : 'No speech recorded. Try again or type your answer.'
      }));
      return;
    }

    if (recognitionRef.current) {
      userStoppedRef.current = true;
      clearSilenceTimer();
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setActiveDictationChunkId(null);
    }

    const SpeechRecognitionCtor = (window as SpeechRecognitionWindow).SpeechRecognition
      ?? (window as SpeechRecognitionWindow).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setDictationMessages((current) => ({
        ...current,
        [chunk.id]: 'Microphone dictation is not available in this browser. You can type your summary instead.'
      }));
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    function resetSilenceTimer() {
      if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(() => {
        userStoppedRef.current = true;
        recognition.stop();
      }, 30000);
    }

    recognition.onresult = (event) => {
      resetSilenceTimer();
      const newTranscript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (newTranscript) {
        setTranscripts((current) => ({ ...current, [chunk.id]: newTranscript }));
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        if (!userStoppedRef.current) {
          // Browser stopped due to silence — restart to keep mic active
          try {
            recognition.start();
            resetSilenceTimer();
            return;
          } catch {
            // restart failed, fall through to cleanup
          }
        }
        clearSilenceTimer();
        recognitionRef.current = null;
        setActiveDictationChunkId(null);
        setDictationMessages((current) => {
          if (current[chunk.id] === 'Listening...') {
            return { ...current, [chunk.id]: 'Recording stopped. Review your text or try again.' };
          }
          return current;
        });
      }
    };

    recognition.onerror = (event) => {
      clearSilenceTimer();
      userStoppedRef.current = true;
      recognitionRef.current = null;
      setActiveDictationChunkId(null);
      setDictationMessages((current) => ({
        ...current,
        [chunk.id]: dictationErrorMessage(event.error)
      }));
    };

    userStoppedRef.current = false;
    recognitionRef.current = recognition;
    setActiveDictationChunkId(chunk.id);
    setDictationMessages((current) => ({ ...current, [chunk.id]: 'Listening...' }));

    requestMicrophonePermission()
      .catch(() => {
        clearSilenceTimer();
        recognitionRef.current = null;
        setActiveDictationChunkId(null);
        setDictationMessages((current) => ({
          ...current,
          [chunk.id]: dictationErrorMessage('not-allowed')
        }));
        throw new Error('Microphone permission was not granted.');
      })
      .then(() => {
        recognition.start();
        resetSilenceTimer();
      })
      .catch(() => undefined);
  }

  return (
    <section aria-label="Lesson reader" className="lesson-reader-shell">
      {wholeReaderProcessing ? (
        <div className="reader-processing-overlay" aria-hidden="true" />
      ) : null}
      {wholeReaderProcessing ? (
        <div role="dialog" aria-label="Processing lesson changes" aria-modal="true" className="reader-processing-dialog">
          <span className="loading-dot" aria-hidden="true" />
          <span>
            <strong>Processing...</strong>
            Updating the reading parts. Please wait a moment.
          </span>
        </div>
      ) : null}
      <div role="region" aria-label="Lesson reader content" aria-busy={wholeReaderProcessing ? 'true' : 'false'} className="lesson-reader-content">
        <header className="lesson-reader-header">
          <div>
            <h1>{title}</h1>
            <p>{allChunksPassed ? 'All reading parts are ready for the whole-text test.' : 'Work through each reading part in order.'}</p>
          </div>
          <span className="status-pill">{chunks.filter((chunk) => isPassed(chunk, chunkMasteryThreshold)).length} of {chunks.length} passed</span>
        </header>

        <div className="reading-part-controls" aria-label="Reading Part controls">
          <label className="compact-field">
            <span>Number of Reading Parts</span>
            <select
              value={currentReadingPartCount}
              disabled={wholeReaderProcessing}
              onChange={(event) => onChangeReadingPartCount?.(Number(event.target.value))}
            >
              {readingPartChoices.map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={wholeReaderProcessing} onClick={onSuggestReadingParts}>Suggest Reading Parts</button>
          <div className="reading-level-segment" role="group" aria-label="Reading level">
            <span>Reading level</span>
            <div className="reading-level-bar">
              {readingLevelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="level-step"
                  aria-pressed={readingLevel === option.value}
                  disabled={wholeReaderProcessing}
                  onClick={() => handleReadingLevelChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {simplificationsProgress && !wholeReaderProcessing ? (
          <div className="prep-progress-wrap" role="status" aria-label="Preparing explanations">
            <div className="prep-progress-header">
              <span>Preparing Explanations</span>
              <span>{Math.round((simplificationsProgress.ready / simplificationsProgress.total) * 100)}%</span>
            </div>
            <div className="prep-progress-track">
              <div
                className="prep-progress-fill"
                style={{ width: `${Math.round((simplificationsProgress.ready / simplificationsProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}
        {isSupportLoading && !openContextChunkId && !wholeReaderProcessing ? (
          <div className="setup-notice" role="status">Thinking through this part...</div>
        ) : null}

        <section aria-label="Reading Parts" className="reading-parts-panel reading-parts-panel-wide">
        <h2>Reading Parts</h2>
        <div className="reading-part-list">
          {chunks.map((chunk, index) => {
            const locked = isLocked(index);
            const testing = testChunkId === chunk.id;
            const simplifiedMode = simplifiedVisible[chunk.id] !== false;
            const storedSimplified = chunk.simplifications?.[readingLevel]?.[0] ?? '';
            const visibleText = simplifiedMode && (storedSimplified || simplifiedTexts[chunk.id])
              ? (storedSimplified || simplifiedTexts[chunk.id])
              : chunk.text;
            const isSimplifying = Boolean(
              simplifiedMode
              && !storedSimplified
              && !simplifiedTexts[chunk.id]
              && isSupportLoading
              && supportLoadingChunkId === chunk.id
            );
            const partScore = score && testing ? score.score : chunk.bestScore;
            const tone = typeof partScore === 'number' ? scoreTone(partScore, chunkMasteryThreshold) : null;
            const transcript = transcripts[chunk.id] ?? '';
            const readingControlsEnabled = !locked && !testing && !wholeReaderProcessing;
            const definitionText = definitionTexts[chunk.id];
            const definitionVisible = Boolean(definitionText && dismissedDefinitionTexts[chunk.id] !== definitionText);
            const isDefining = Boolean(
              !definitionText
              && isSupportLoading
              && supportLoadingChunkId === chunk.id
              && openContextChunkId !== chunk.id
              && !isSimplifying
            );

            return (
              <article
                key={chunk.id}
                ref={(element) => {
                  readingPartRefs.current[chunk.id] = element;
                }}
                aria-label={`Reading Part ${chunk.index + 1}`}
                className={locked ? 'reading-part-card reading-part-card-locked' : 'reading-part-card'}
                data-locked={locked ? 'true' : 'false'}
              >
                <div className="reading-part-card-header">
                  <div className="reading-part-title">
                    <div className="reading-part-title-line">
                      <h3>Reading Part {chunk.index + 1}</h3>
                      <button
                        type="button"
                        className="icon-button read-aloud-button"
                        aria-label={speakingChunkId === chunk.id ? `Stop reading Reading Part ${chunk.index + 1}` : `Read Reading Part ${chunk.index + 1} aloud`}
                        disabled={!readingControlsEnabled}
                        onClick={() => void readTextAloud(chunk.id, visibleText)}
                      >
                        {speakingChunkId === chunk.id ? <Square size={14} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
                      </button>
                    </div>
                    <span className="part-state">{locked ? 'Locked' : isPassed(chunk, chunkMasteryThreshold) ? 'Passed' : 'Ready'}</span>
                  </div>
                  <div className="part-actions">
                    {tone ? (
                      <span className="score-badge">
                        <span aria-label={tone.label} className={tone.className}>{tone.symbol}</span>
                        {partScore}%
                      </span>
                    ) : null}
                    <button
                      ref={(element) => {
                        contextButtonRefs.current[chunk.id] = element;
                      }}
                      type="button"
                      className="explain-part-button"
                      aria-label={`Explain Reading Part ${chunk.index + 1}`}
                      aria-expanded={openContextChunkId === chunk.id}
                      disabled={!readingControlsEnabled}
                      onClick={() => handleContextClick(chunk)}
                    >
                      <Lightbulb size={16} aria-hidden="true" />
                      <span>Explain</span>
                    </button>
                    <div className="mode-toggle" role="group" aria-label={`Text mode for Reading Part ${chunk.index + 1}`}>
                      <button
                        type="button"
                        aria-pressed={simplifiedMode}
                        aria-label={`Simplified text for Reading Part ${chunk.index + 1}`}
                        disabled={!readingControlsEnabled}
                        onClick={() => setReadingPartMode(chunk, 'simplified')}
                      >
                        Simplified
                      </button>
                      <button
                        type="button"
                        aria-pressed={!simplifiedMode}
                        aria-label={`Original text for Reading Part ${chunk.index + 1}`}
                        disabled={!readingControlsEnabled}
                        onClick={() => setReadingPartMode(chunk, 'original')}
                      >
                        Original
                      </button>
                    </div>
                  </div>
                </div>

                <div className="reading-part-body">
                  {isSimplifying ? (
                    <div role="status" aria-label={`Simplifying Reading Part ${chunk.index + 1}`} className="simplifying-overlay">
                      <span className="loading-dot" aria-hidden="true" />
                      <span>
                        <strong>Simplifying...</strong>
                        Keeping the original text visible while AI rewrites this part.
                      </span>
                    </div>
                  ) : null}
                  {isDefining ? (
                    <div role="status" aria-label={`Defining word in Reading Part ${chunk.index + 1}`} className="definition-popover definition-popover-loading">
                      <span className="loading-dot" aria-hidden="true" />
                      <span>
                        <strong>Defining...</strong>
                        Looking up this word in the context of the reading part.
                      </span>
                    </div>
                  ) : null}
                  {definitionVisible ? (
                    <div
                      ref={(element) => {
                        definitionPopoverRefs.current[chunk.id] = element;
                      }}
                      role="dialog"
                      aria-label={`Definition for Reading Part ${chunk.index + 1}`}
                      className="definition-popover"
                    >
                      <div className="definition-popover-header">
                        <strong>Definition</strong>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Close definition for Reading Part ${chunk.index + 1}`}
                          onClick={() => setDismissedDefinitionTexts((current) => ({ ...current, [chunk.id]: definitionText ?? '' }))}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <p>{definitionText}</p>
                    </div>
                  ) : null}
                  <SelectableText
                    text={visibleText}
                    textClassName={testing ? 'blurred-reading-text' : undefined}
                    onDefine={(selectedText) => onDefineVocabulary?.({
                      chunkId: chunk.id,
                      selectedText,
                      contextText: chunk.text
                    })}
                  />
                </div>

                {openContextChunkId === chunk.id ? (() => {
                  const chunkVersions = chunk.simplifications?.[readingLevel] ?? [];
                  const hasStoredVersions = chunkVersions.length > 0;
                  const versionIndex = explainVersionIndex[chunk.id] ?? 0;
                  const explainText = hasStoredVersions
                    ? chunkVersions[versionIndex]
                    : contextTexts[chunk.id];
                  const explainAudioKey = `${chunk.id}-explanation`;

                  return (
                    <div
                      ref={(element) => {
                        contextPopoverRefs.current[chunk.id] = element;
                      }}
                      role="dialog"
                      aria-label={`Simplified explanation for Reading Part ${chunk.index + 1}`}
                      className="context-popover"
                    >
                      <div className="context-popover-header">
                        <strong>
                          {hasStoredVersions
                            ? `Simplified (${versionIndex + 1} of ${chunkVersions.length})`
                            : `Reading Part ${chunk.index + 1} explanation`}
                        </strong>
                        <div className="context-popover-header-actions">
                          {hasStoredVersions && chunkVersions.length > 1 ? (
                            <>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label="Previous simplified version"
                                disabled={versionIndex === 0}
                                onClick={() => {
                                  if (speakingChunkId === explainAudioKey) {
                                    activeAudioRef.current?.pause();
                                    activeAudioRef.current = null;
                                    setSpeakingChunkId(null);
                                  }
                                  setExplainVersionIndex((prev) => ({ ...prev, [chunk.id]: Math.max(0, versionIndex - 1) }));
                                }}
                              >
                                <ChevronLeft size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label="Next simplified version"
                                disabled={versionIndex >= chunkVersions.length - 1}
                                onClick={() => {
                                  if (speakingChunkId === explainAudioKey) {
                                    activeAudioRef.current?.pause();
                                    activeAudioRef.current = null;
                                    setSpeakingChunkId(null);
                                  }
                                  setExplainVersionIndex((prev) => ({ ...prev, [chunk.id]: Math.min(chunkVersions.length - 1, versionIndex + 1) }));
                                }}
                              >
                                <ChevronRight size={16} aria-hidden="true" />
                              </button>
                            </>
                          ) : null}
                          {explainText ? (
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={speakingChunkId === explainAudioKey ? `Stop reading explanation for Reading Part ${chunk.index + 1}` : `Read explanation for Reading Part ${chunk.index + 1} aloud`}
                              onClick={() => void readTextAloud(explainAudioKey, explainText)}
                            >
                              {speakingChunkId === explainAudioKey ? <Square size={14} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Close explanation for Reading Part ${chunk.index + 1}`}
                            onClick={() => {
                              if (speakingChunkId === explainAudioKey) {
                                activeAudioRef.current?.pause();
                                activeAudioRef.current = null;
                                setSpeakingChunkId(null);
                              }
                              setOpenContextChunkId(null);
                            }}
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p>
                        {hasStoredVersions
                          ? explainText
                          : (supportLoadingChunkId === chunk.id
                              ? 'Thinking through this explanation...'
                              : explainText ?? (simplificationsProgress ? 'Generating simplified explanations...' : 'Explanation will appear here in a moment.'))}
                      </p>
                      {!hasStoredVersions ? (
                        <button type="button" className="secondary-button compact-button" onClick={() => {
                          if (speakingChunkId === explainAudioKey) {
                            activeAudioRef.current?.pause();
                            activeAudioRef.current = null;
                            setSpeakingChunkId(null);
                          }
                          onExplainAgain?.({ chunkId: chunk.id, text: chunk.text });
                        }}>
                          Explain This Better
                        </button>
                      ) : null}
                    </div>
                  );
                })() : null}

                <div className="reading-part-footer">
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    disabled={locked || wholeReaderProcessing}
                    onClick={() => {
                      setOpenContextChunkId(null);
                      setTestChunkId(chunk.id);
                    }}
                  >
                    Test Reading Part {chunk.index + 1}
                  </button>
                </div>

                {testing ? (
                  <section aria-label={`Test Reading Part ${chunk.index + 1}`} className="inline-test-panel">
                    <label className="field">
                      <span>Your summary for Reading Part {chunk.index + 1}</span>
                      <div className="summary-input-wrap">
                        <textarea
                          value={transcript}
                          onChange={(event) => setTranscripts((current) => ({ ...current, [chunk.id]: event.target.value }))}
                          placeholder="Type the idea in your own words."
                        />
                        <button
                          type="button"
                          className={activeDictationChunkId === chunk.id ? 'summary-mic-button summary-mic-button-active' : 'summary-mic-button'}
                          aria-label={activeDictationChunkId === chunk.id ? `Stop recording for Reading Part ${chunk.index + 1}` : `Record summary for Reading Part ${chunk.index + 1}`}
                          aria-pressed={activeDictationChunkId === chunk.id}
                          onClick={() => toggleDictation(chunk)}
                        >
                          {activeDictationChunkId === chunk.id ? <Square size={14} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
                        </button>
                      </div>
                    </label>
                    <div className="practice-actions">
                      <button type="button" className="secondary-button compact-button" onClick={() => handleReviewAgain(chunk)}>
                        Review Again
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={!transcript.trim() || isSubmitting}
                        onClick={() => onSubmitParaphrase?.({ chunkId: chunk.id, transcript, referenceText: visibleText })}
                      >
                        Submit Test
                      </button>
                    </div>
                    {dictationMessages[chunk.id] ? <p className="dictation-message" role="status">{dictationMessages[chunk.id]}</p> : null}
                    {score ? (
                      <div className="score-result">
                        <strong>{score.score}%</strong>
                        <p role="status" aria-label="Test result guidance" className={score.score >= chunkMasteryThreshold ? 'score-guidance score-guidance-pass' : 'score-guidance score-guidance-review'}>
                          {scoreGuidance(score, chunkMasteryThreshold)}
                        </p>
                        <p>{score.feedback}</p>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </article>
            );
          })}
        </div>
        </section>

        {allChunksPassed ? (
          <section aria-label="Whole text test" className="final-summary-panel">
          <h2>Whole Text Test</h2>
          <label className="field">
            <span>Whole text summary</span>
            <textarea
              value={finalTranscript}
              onChange={(event) => setFinalTranscript(event.target.value)}
              placeholder="Explain what the whole text means, including how the parts connect."
            />
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!finalTranscript.trim() || isSubmittingFinal}
            onClick={() => onSubmitFinalSummary?.(finalTranscript)}
          >
            Submit Whole Text Test
          </button>
          {finalScore ? (
            <div className="score-result">
              <strong>{finalScore.score}%</strong>
              <p>{finalScore.feedback}</p>
            </div>
          ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}
