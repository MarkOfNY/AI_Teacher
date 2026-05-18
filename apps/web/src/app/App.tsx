import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import type { AiCapability, AiProvider, AiRoutingPreferences, ReadingLevel } from '@ai-teacher/shared';
import { DEFAULT_ROUTING_PREFERENCES } from '@ai-teacher/shared';
import { defineVocabulary, explainContext, explainGaps, simplifyText } from '../api/aiClient';
import {
  createUserSession,
  createMaterial,
  deleteMaterial,
  generateChunkSimplifications,
  getMaterial,
  listMaterials,
  type MaterialDetailResponse,
  type ScoreResponse,
  submitParaphraseAttempt,
  suggestReadingParts,
  updateMaterial,
  updateReadingParts
} from '../api/materialsClient';
import { getProfile, updateAllRoutingPreferences, updateThresholds, type ProfileResponse } from '../api/profileClient';
import { GoogleLoginButton } from '../auth/GoogleLoginButton';
import { LessonReader } from '../lessons/LessonReader';
import { type CreateMaterialInput, MaterialEditor, type UpdateMaterialInput } from '../parent/MaterialEditor';
import { ParentDashboard } from '../parent/ParentDashboard';
import { AiRoutingSettings } from '../settings/AiRoutingSettings';
import { MasterySettings } from '../settings/MasterySettings';

interface MaterialSummary {
  id: string;
  title: string;
  status: string;
  finalBestScore: number | null;
}

function countSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.length ?? 0;
}

function scrollToPageTop() {
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    // jsdom defines scrollTo but does not implement it; browsers use this path normally.
  }
}

const CREDENTIAL_KEY = 'ai_teacher_credential';

function loadPersistedCredential(): string | null {
  try {
    const saved = localStorage.getItem(CREDENTIAL_KEY);
    if (!saved) return null;
    const parts = saved.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1])) as { exp?: number };
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem(CREDENTIAL_KEY);
        return null;
      }
    }
    return saved;
  } catch {
    return null;
  }
}

export function App() {
  const hasQaSession = import.meta.env.DEV && new URLSearchParams(window.location.search).get('qaSession') === 'true';
  const [credential, setCredential] = useState<string | null>(
    hasQaSession ? 'qa-session' : loadPersistedCredential()
  );

  function handleCredential(cred: string) {
    localStorage.setItem(CREDENTIAL_KEY, cred);
    setCredential(cred);
  }

  function handleSignOut() {
    localStorage.removeItem(CREDENTIAL_KEY);
    setCredential(null);
  }
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialDetailResponse | null>(null);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [finalScore, setFinalScore] = useState<ScoreResponse | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isScoringFinal, setIsScoringFinal] = useState(false);
  const [simplificationsProgress, setSimplificationsProgress] = useState<{ ready: number; total: number; levelLabel: string } | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingRouting, setIsSavingRouting] = useState(false);
  const [simplifiedTexts, setSimplifiedTexts] = useState<Record<string, string>>({});
  const [contextTexts, setContextTexts] = useState<Record<string, string>>({});
  const [explainAgainCounts, setExplainAgainCounts] = useState<Record<string, number>>({});
  const [definitionTexts, setDefinitionTexts] = useState<Record<string, string>>({});
  const [isSupportLoading, setIsSupportLoading] = useState(false);
  const [supportLoadingChunkId, setSupportLoadingChunkId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isMaterialLoading, setIsMaterialLoading] = useState(false);
  const [loadingMaterialId, setLoadingMaterialId] = useState<string | null>(null);
  const [isReaderProcessing, setIsReaderProcessing] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<'take' | 'manage' | 'settings'>('take');
  const [editingMaterial, setEditingMaterial] = useState<{ id: string; title: string; originalText: string } | null>(null);
  const suggestionsCache = useRef(new Map<string, number>());
  const simplificationAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (!credential) {
      return;
    }

    let ignore = false;
    setStatusMessage('Preparing workspace...');

    void (async () => {
      try {
        const session = await createUserSession();
        if (ignore) return;

        const [loadedMaterials, loadedProfile] = await Promise.all([
          listMaterials(session.user.id),
          getProfile(session.user.id).catch(() => null)
        ]);

        if (!ignore) {
          setUserProfileId(session.user.id);
          setMaterials(loadedMaterials);
          setProfile(loadedProfile);
          setStatusMessage(null);
        }
      } catch {
        if (!ignore) {
          setStatusMessage('Could not prepare workspace. Check that the API is running.');
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [credential]);

  async function runSupportRequest(input: {
    chunkId: string;
    capability: AiCapability;
    action: (provider: AiProvider) => Promise<string>;
    onSuccess: (text: string) => void;
  }) {
    const prefs = profile?.routingPreferences ?? DEFAULT_ROUTING_PREFERENCES;
    const primaryProvider = prefs[input.capability];
    const fallbackProvider = prefs.fallback;

    if (primaryProvider === 'disabled' || primaryProvider === 'browserTts') return;

    const hasDifferentFallback =
      fallbackProvider !== primaryProvider
      && fallbackProvider !== 'disabled'
      && fallbackProvider !== 'browserTts';

    setIsSupportLoading(true);
    setSupportLoadingChunkId(input.chunkId);
    try {
      const text = await input.action(primaryProvider);
      input.onSuccess(text);
      setStatusMessage(null);
    } catch (primaryError) {
      if (!hasDifferentFallback) {
        setStatusMessage(primaryError instanceof Error ? primaryError.message : `${primaryProvider} failed.`);
        return;
      }
      try {
        const text = await input.action(fallbackProvider);
        input.onSuccess(text);
        setStatusMessage(null);
      } catch (fallbackError) {
        const primaryMsg = primaryError instanceof Error ? primaryError.message : `${primaryProvider} failed.`;
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : `${fallbackProvider} failed.`;
        setStatusMessage(`${primaryMsg} Fallback also failed: ${fallbackMsg}`);
      }
    } finally {
      setIsSupportLoading(false);
      setSupportLoadingChunkId(null);
    }
  }

  async function handleCreateMaterial(input: CreateMaterialInput) {
    if (!userProfileId) {
      setStatusMessage('Student workspace is still loading. Try again in a moment.');
      return;
    }

    setStatusMessage('Creating lesson...');
    try {
      const material = await createMaterial({
        userProfileId,
        title: input.title,
        originalText: input.originalText,
      });

      setMaterials((currentMaterials) => [
        {
          id: material.id,
          title: material.title,
          status: material.status,
          finalBestScore: material.finalBestScore,
        },
        ...currentMaterials,
      ]);
      setActiveWorkspace('take');
      setStatusMessage('Lesson created.');
      void handleSelectMaterial(material.id);
    } catch {
      setStatusMessage('Could not create the lesson. Check that the API is running.');
    }
  }

  async function handleEditMaterial(materialId: string) {
    setActiveWorkspace('manage');
    setStatusMessage('Loading lesson for editing...');
    try {
      const material = await getMaterial(materialId);
      setEditingMaterial({
        id: material.id,
        title: material.title,
        originalText: material.originalText
      });
      setStatusMessage(null);
    } catch {
      setStatusMessage('Could not load the lesson for editing.');
    }
  }

  async function handleUpdateMaterial(input: UpdateMaterialInput) {
    setStatusMessage('Saving lesson changes...');
    try {
      const material = await updateMaterial(input);
      suggestionsCache.current.delete(material.id);
      setMaterials((currentMaterials) => currentMaterials.map((currentMaterial) => (
        currentMaterial.id === material.id
          ? { id: material.id, title: material.title, status: material.status, finalBestScore: material.finalBestScore }
          : currentMaterial
      )));
      setEditingMaterial(null);
      if (selectedMaterial?.id === material.id) {
        setSelectedMaterial(material);
        setScore(null);
        setFinalScore(null);
        setSimplifiedTexts({});
        setContextTexts({});
        setDefinitionTexts({});
      }
      setStatusMessage('Lesson updated.');
    } catch {
      setStatusMessage('Could not update the lesson. Check that the API is running.');
    }
  }

  async function handleDeleteMaterial(materialId: string) {
    const material = materials.find((candidate) => candidate.id === materialId);
    const title = material?.title ?? 'this lesson';
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) {
      return;
    }

    setStatusMessage('Deleting lesson...');
    try {
      await deleteMaterial(materialId);
      suggestionsCache.current.delete(materialId);
      setMaterials((currentMaterials) => currentMaterials.filter((candidate) => candidate.id !== materialId));
      if (selectedMaterial?.id === materialId) {
        setSelectedMaterial(null);
        setScore(null);
        setFinalScore(null);
      }
      if (editingMaterial?.id === materialId) {
        setEditingMaterial(null);
      }
      setStatusMessage('Lesson deleted.');
    } catch {
      setStatusMessage('Could not delete the lesson. Check that the API is running.');
    }
  }

  async function handleSelectMaterial(materialId: string) {
    setActiveWorkspace('take');
    scrollToPageTop();
    setIsMaterialLoading(true);
    setLoadingMaterialId(materialId);
    setStatusMessage('Loading lesson...');
    try {
      let material = await getMaterial(materialId);
      const cached = suggestionsCache.current.get(materialId);

      if (cached !== undefined) {
        if (cached !== material.chunks.length) {
          try {
            material = await updateReadingParts({ materialId: material.id, readingPartCount: cached });
          } catch {
            // Keep current chunking if update fails
          }
        }
      } else {
        try {
          setStatusMessage('Preparing suggested reading parts...');
          const suggestion = await suggestReadingParts(material.id);
          suggestionsCache.current.set(materialId, suggestion.readingPartCount);
          if (suggestion.readingPartCount > 0 && suggestion.readingPartCount !== material.chunks.length) {
            material = await updateReadingParts({
              materialId: material.id,
              readingPartCount: suggestion.readingPartCount,
            });
          }
        } catch {
          setStatusMessage('Opened lesson, but could not suggest reading parts automatically.');
        }
      }

      setSelectedMaterial(material);
      setScore(null);
      setFinalScore(null);
      setSimplifiedTexts({});
      setContextTexts({});
      setDefinitionTexts({});
      setSimplificationsProgress(null);
      setStatusMessage('Preparing audio...');
      simplificationAbortRef.current.aborted = true;
      const abort = { aborted: false };
      simplificationAbortRef.current = abort;

      void (async () => {
        const levels = ['simple', 'verySimple', 'middleSchool'] as const;
        const levelLabels: Record<typeof levels[number], string> = {
          simple: 'Simple',
          verySimple: 'Very Simple',
          middleSchool: 'Intermediate'
        };
        const provider = getSimplifyProvider();
        const materialId = material.id;
        const levelChunks = levels.map((level) => ({
          level,
          chunks: material.chunks.filter((c) => (c.simplifications?.[level]?.length ?? 0) < 5)
        }));
        const total = levelChunks.reduce((sum, { chunks }) => sum + chunks.length, 0);
        if (total === 0) return;

        let ready = 0;

        for (const { level, chunks } of levelChunks) {
          if (abort.aborted) break;
          if (chunks.length === 0) continue;
          const levelLabel = levelLabels[level];
          setSimplificationsProgress({ ready, total, levelLabel });
          for (const chunk of chunks) {
            if (abort.aborted) break;
            try {
              const result = await generateChunkSimplifications(materialId, chunk.id, level, provider);
              if (!abort.aborted) {
                setSelectedMaterial((current) => {
                  if (!current || current.id !== materialId) return current;
                  return {
                    ...current,
                    chunks: current.chunks.map((c) =>
                      c.id === chunk.id ? { ...c, simplifications: result.simplifications } : c
                    )
                  };
                });
              }
            } catch {
              // skip — lesson still works without pre-generated simplifications
            }
            ready++;
            if (!abort.aborted) setSimplificationsProgress({ ready, total, levelLabel });
          }
        }
        if (!abort.aborted) setSimplificationsProgress(null);
      })();
      // isMaterialLoading stays true here — cleared by handleFirstAudioCached once first chunk audio is ready
    } catch {
      setStatusMessage('Could not open the lesson. Check that the API is running.');
      setIsMaterialLoading(false);
    } finally {
      setLoadingMaterialId(null);
    }
  }

  const handleFirstAudioCached = useCallback(() => {
    setIsMaterialLoading(false);
    setStatusMessage(null);
  }, []);

  function getSimplifyProvider(): 'qwen' | 'deepseek' | 'openai' {
    const p = (profile?.routingPreferences ?? DEFAULT_ROUTING_PREFERENCES).simplifyText;
    if (!p || p === 'disabled' || p === 'browserTts') return 'qwen';
    return p as 'qwen' | 'deepseek' | 'openai';
  }

  function runSimplificationGeneration(material: MaterialDetailResponse, readingLevel: Exclude<ReadingLevel, 'original'>): Promise<void> {
    const chunksNeeding = material.chunks.filter(
      (c) => (c.simplifications?.[readingLevel]?.length ?? 0) < 5
    );
    if (chunksNeeding.length === 0) return Promise.resolve();

    const levelLabels: Record<Exclude<ReadingLevel, 'original'>, string> = {
      simple: 'Simple',
      verySimple: 'Very Simple',
      middleSchool: 'Intermediate'
    };
    const materialId = material.id;
    const provider = getSimplifyProvider();
    setSimplificationsProgress({ ready: 0, total: chunksNeeding.length, levelLabel: levelLabels[readingLevel] });

    return (async () => {
      let ready = 0;
      for (const chunk of chunksNeeding) {
        try {
          const result = await generateChunkSimplifications(materialId, chunk.id, readingLevel, provider);
          setSelectedMaterial((current) => {
            if (!current || current.id !== materialId) return current;
            return {
              ...current,
              chunks: current.chunks.map((c) =>
                c.id === chunk.id ? { ...c, simplifications: result.simplifications } : c
              )
            };
          });
        } catch {
          // skip this chunk — lesson still works with fallback
        }
        ready++;
        setSimplificationsProgress((prev) => (prev ? { ...prev, ready } : null));
      }
      setSimplificationsProgress(null);
    })();
  }

  async function handleSubmitParaphrase(input: { chunkId: string; transcript: string; referenceText: string }) {
    if (!selectedMaterial) {
      return;
    }

    setIsScoring(true);
    try {
      const result = await submitParaphraseAttempt({
        materialId: selectedMaterial.id,
        chunkId: input.chunkId,
        scope: 'chunk',
        transcript: input.transcript,
        referenceText: input.referenceText
      });
      setScore(result);
      const refreshed = await getMaterial(selectedMaterial.id);
      setSelectedMaterial(refreshed);
      setStatusMessage(result.passed ? 'Reading part mastered.' : 'That did not score high enough yet. Try Again or use the info button to explain this part better.');
    } catch {
      setStatusMessage('Could not score the paraphrase. Check that the API is running.');
    } finally {
      setIsScoring(false);
    }
  }

  async function handleSubmitFinalSummary(transcript: string) {
    if (!selectedMaterial) {
      return;
    }

    setIsScoringFinal(true);
    try {
      const result = await submitParaphraseAttempt({
        materialId: selectedMaterial.id,
        scope: 'final',
        transcript
      });
      setFinalScore(result);
      const refreshed = await getMaterial(selectedMaterial.id);
      setSelectedMaterial(refreshed);
      setMaterials((currentMaterials) => currentMaterials.map((material) => (
        material.id === refreshed.id
          ? { id: refreshed.id, title: refreshed.title, status: refreshed.status, finalBestScore: refreshed.finalBestScore }
          : material
      )));
      setStatusMessage(result.passed ? 'Material completed.' : 'The final summary needs another pass.');
    } catch {
      setStatusMessage('Could not score the final summary. Check that the API is running.');
    } finally {
      setIsScoringFinal(false);
    }
  }

  function handleSimplify(input: { chunkId: string; text: string; readingLevel?: ReadingLevel }) {
    void runSupportRequest({
      chunkId: input.chunkId,
      capability: 'simplifyText',
      action: async (provider) => {
        const response = await simplifyText({ text: input.text, readingLevel: input.readingLevel ?? 'simple', provider });
        return response.text;
      },
      onSuccess: (text) => setSimplifiedTexts((currentTexts) => ({ ...currentTexts, [input.chunkId]: text }))
    });
  }

  function handleExplainContext(input: { chunkId: string; text: string }) {
    void runSupportRequest({
      chunkId: input.chunkId,
      capability: 'explainContext',
      action: async (provider) => {
        const response = await explainContext({ text: input.text, provider });
        return response.explanation;
      },
      onSuccess: (text) => setContextTexts((currentTexts) => ({ ...currentTexts, [input.chunkId]: text }))
    });
  }

  function handleDefineVocabulary(input: { chunkId: string; selectedText: string; contextText: string }) {
    void runSupportRequest({
      chunkId: input.chunkId,
      capability: 'defineVocabulary',
      action: async (provider) => {
        const response = await defineVocabulary({ term: input.selectedText, contextText: input.contextText, provider });
        return response.definition;
      },
      onSuccess: (text) => setDefinitionTexts((currentTexts) => ({ ...currentTexts, [input.chunkId]: text }))
    });
  }

  function handleExplainAgain(input: { chunkId: string; text: string }) {
    const attempt = (explainAgainCounts[input.chunkId] ?? 0) + 1;
    setExplainAgainCounts((current) => ({ ...current, [input.chunkId]: attempt }));
    void runSupportRequest({
      chunkId: input.chunkId,
      capability: 'generateGapAwareExplanation',
      action: async (provider) => {
        const response = await explainGaps({ text: input.text, missed: [], attempt, provider });
        return response.explanation;
      },
      onSuccess: (text) => setContextTexts((currentTexts) => ({ ...currentTexts, [input.chunkId]: text }))
    });
  }

  function handleReadingLevelChange(level: ReadingLevel) {
    if (!selectedMaterial || level === 'original') return;
    void runSimplificationGeneration(selectedMaterial, level as Exclude<ReadingLevel, 'original'>);
  }

  async function handleChangeReadingPartCount(readingPartCount: number) {
    if (!selectedMaterial) {
      return;
    }

    setIsReaderProcessing(true);
    setStatusMessage('Updating reading parts...');
    try {
      const material = await updateReadingParts({ materialId: selectedMaterial.id, readingPartCount });
      suggestionsCache.current.set(selectedMaterial.id, readingPartCount);
      setSelectedMaterial(material);
      setScore(null);
      setFinalScore(null);
      setSimplifiedTexts({});
      setContextTexts({});
      setDefinitionTexts({});
      setStatusMessage(null);
    } catch {
      setStatusMessage('Could not update reading parts. Check that the API is running.');
    } finally {
      setIsReaderProcessing(false);
    }
  }

  async function handleSuggestReadingParts() {
    if (!selectedMaterial) {
      return;
    }

    setStatusMessage('Suggesting reading parts...');
    setIsReaderProcessing(true);
    try {
      const suggestion = await suggestReadingParts(selectedMaterial.id);
      suggestionsCache.current.set(selectedMaterial.id, suggestion.readingPartCount);
      const material = await updateReadingParts({ materialId: selectedMaterial.id, readingPartCount: suggestion.readingPartCount });
      setSelectedMaterial(material);
      setScore(null);
      setFinalScore(null);
      setSimplifiedTexts({});
      setContextTexts({});
      setDefinitionTexts({});
      setStatusMessage(null);
    } catch {
      setStatusMessage('Could not suggest reading parts. Check that the API is running.');
    } finally {
      setIsReaderProcessing(false);
    }
  }

  async function handleSaveThresholds(input: { chunkMasteryThreshold: number; finalSummaryMasteryThreshold: number }) {
    if (!userProfileId) return;
    setIsSavingSettings(true);
    try {
      await updateThresholds(userProfileId, input);
      setProfile((current) => current ? { ...current, ...input } : null);
      setStatusMessage('Thresholds saved.');
    } catch {
      setStatusMessage('Could not save thresholds. Check that the API is running.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleSaveRoutingPreferences(prefs: AiRoutingPreferences) {
    if (!userProfileId) return;
    setIsSavingRouting(true);
    try {
      await updateAllRoutingPreferences(userProfileId, prefs);
      setProfile((current) => current ? { ...current, routingPreferences: prefs } : null);
      setStatusMessage('AI routing saved.');
    } catch {
      setStatusMessage('Could not save AI routing. Check that the API is running.');
    } finally {
      setIsSavingRouting(false);
    }
  }

  const appContent = credential ? (
    <main className="app-shell">
        <header className="app-header">
          <div>
            <h1>AI Teacher</h1>
          </div>
          <div className="header-actions">
            <span className="status-pill">Local demo</span>
            {!hasQaSession && (
              <button type="button" className="sign-out-btn" onClick={handleSignOut}>
                Sign out
              </button>
            )}
          </div>
        </header>
        {statusMessage ? (
          <div className="setup-notice" role="status">
            <span>{statusMessage}</span>
          </div>
        ) : null}
        {isMaterialLoading ? (
          <div className="lesson-loading-overlay" role="dialog" aria-modal="true" aria-label="Loading lesson">
            <div className="lesson-loading-box">
              <div className="loading-progress" role="progressbar" aria-label="Loading lesson">
                <span />
              </div>
              <p>{statusMessage ?? 'Loading Lesson...'}</p>
              {simplificationsProgress ? (
                <div className="prep-progress-wrap overlay-progress" role="status" aria-label="Preparing explanations">
                  <div className="prep-progress-header">
                    <span>Preparing {simplificationsProgress.levelLabel} Explanations</span>
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
            </div>
          </div>
        ) : null}
        <nav className="workspace-tabs" role="tablist" aria-label="Workspace sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeWorkspace === 'take'}
            aria-controls="take-lesson-panel"
            id="take-lesson-tab"
            onClick={() => setActiveWorkspace('take')}
          >
            Take Lesson
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeWorkspace === 'manage'}
            aria-controls="manage-lessons-panel"
            id="manage-lessons-tab"
            onClick={() => setActiveWorkspace('manage')}
          >
            Manage Lessons
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeWorkspace === 'settings'}
            aria-controls="settings-panel"
            id="settings-tab"
            onClick={() => setActiveWorkspace('settings')}
          >
            Settings
          </button>
        </nav>
        {activeWorkspace === 'take' ? (
          <section
            id="take-lesson-panel"
            role="tabpanel"
            aria-labelledby="take-lesson-tab"
            aria-label="Take lesson"
            className="workspace-section"
          >
            <div className="lesson-picker-panel">
              <label className="lesson-picker-field">
                <span>Choose lesson</span>
                <select
                  aria-label="Choose lesson"
                  value={loadingMaterialId ?? selectedMaterial?.id ?? ''}
                  disabled={isMaterialLoading}
                  onChange={(event) => {
                    const materialId = event.target.value;
                    if (!materialId) {
                      setLoadingMaterialId(null);
                      setSelectedMaterial(null);
                      setScore(null);
                      setFinalScore(null);
                      return;
                    }
                    void handleSelectMaterial(materialId);
                  }}
                >
                  <option value="">Select a lesson</option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {selectedMaterial ? (
              <LessonReader
                title={selectedMaterial.title}
                chunks={selectedMaterial.chunks}
                chunkMasteryThreshold={profile?.chunkMasteryThreshold ?? 80}
                readingPartCount={selectedMaterial.chunks.length}
                sentenceCount={Math.max(1, countSentences(selectedMaterial.originalText))}
                score={score}
                finalScore={finalScore}
                isSubmitting={isScoring}
                isSubmittingFinal={isScoringFinal}
                simplifiedTexts={simplifiedTexts}
                contextTexts={contextTexts}
                definitionTexts={definitionTexts}
                isSupportLoading={isSupportLoading}
                supportLoadingChunkId={supportLoadingChunkId}
                isReaderProcessing={isReaderProcessing}
                onChangeReadingPartCount={(readingPartCount) => void handleChangeReadingPartCount(readingPartCount)}
                onSuggestReadingParts={() => void handleSuggestReadingParts()}
                onSubmitParaphrase={(input) => void handleSubmitParaphrase(input)}
                onSubmitFinalSummary={(transcript) => void handleSubmitFinalSummary(transcript)}
                simplificationsProgress={simplificationsProgress}
                onReadingLevelChange={handleReadingLevelChange}
                onSimplify={handleSimplify}
                onExplainContext={handleExplainContext}
                onExplainAgain={handleExplainAgain}
                onDefineVocabulary={handleDefineVocabulary}
                onFirstAudioCached={handleFirstAudioCached}
              />
            ) : (
              <div className="reader-empty-state">
                <strong>Select a lesson to begin</strong>
                <p>Pick a lesson above to review reading parts, adjust the level, and continue mastery work.</p>
              </div>
            )}
          </section>
        ) : null}
        {activeWorkspace === 'manage' ? (
          <section
            id="manage-lessons-panel"
            role="tabpanel"
            aria-labelledby="manage-lessons-tab"
            aria-label="Lesson management"
            className="workspace-grid"
          >
            <MaterialEditor
              editingMaterial={editingMaterial}
              onCancelEdit={() => setEditingMaterial(null)}
              onCreateMaterial={(input) => void handleCreateMaterial(input)}
              onUpdateMaterial={(input) => void handleUpdateMaterial(input)}

            />
            <ParentDashboard
              materials={materials}
              onSelectMaterial={(materialId) => void handleSelectMaterial(materialId)}
              onEditMaterial={(materialId) => void handleEditMaterial(materialId)}
              onDeleteMaterial={(materialId) => void handleDeleteMaterial(materialId)}
            />
          </section>
        ) : null}
        {activeWorkspace === 'settings' ? (
          <section
            id="settings-panel"
            role="tabpanel"
            aria-labelledby="settings-tab"
            aria-label="Settings"
            className="settings-section"
          >
            <MasterySettings
              chunkMasteryThreshold={profile?.chunkMasteryThreshold ?? 80}
              finalSummaryMasteryThreshold={profile?.finalSummaryMasteryThreshold ?? 80}
              onSave={(thresholds) => void handleSaveThresholds(thresholds)}
              isSaving={isSavingSettings}
            />
            <AiRoutingSettings
              preferences={profile?.routingPreferences ?? DEFAULT_ROUTING_PREFERENCES}
              onSave={(prefs) => void handleSaveRoutingPreferences(prefs)}
              isSaving={isSavingRouting}
            />
          </section>
        ) : null}
      </main>
  ) : (
    <main className="login-shell">
      <section className="login-panel">
        <p className="eyebrow">Reading comprehension support</p>
        <h1>AI Teacher</h1>
        <p className="login-copy">Sign in to start lessons, track progress, and tune support settings.</p>
        {googleClientId ? (
          <GoogleLoginButton onCredential={handleCredential} />
        ) : (
          <>
            <button type="button" disabled>
              Login with Google
            </button>
            <div className="setup-notice" role="status">
              Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>apps/web/.env.local</code> to enable Google sign-in.
            </div>
          </>
        )}
      </section>
    </main>
  );

  if (googleClientId) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        {appContent}
      </GoogleOAuthProvider>
    );
  }

  return appContent;
}
