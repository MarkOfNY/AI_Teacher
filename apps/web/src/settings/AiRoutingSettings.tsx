import { useEffect, useState } from 'react';
import type { AiCapability, AiProvider, AiRoutingPreferences } from '@ai-teacher/shared';

const PROVIDER_LABELS: Record<AiProvider, string> = {
  qwen:       'Qwen',
  deepseek:   'DeepSeek',
  openai:     'OpenAI',
  browserTts: 'Browser TTS',
  disabled:   'Disabled',
};

interface CapabilityGroup {
  label: string;
  capabilities: Array<{ key: AiCapability; label: string; providers: AiProvider[] }>;
}

const GROUPS: CapabilityGroup[] = [
  {
    label: 'Reading Support',
    capabilities: [
      { key: 'simplifyText',       label: 'Simplify text',     providers: ['qwen', 'deepseek', 'openai', 'disabled'] },
      { key: 'explainContext',     label: 'Explain context',   providers: ['qwen', 'deepseek', 'openai', 'disabled'] },
      { key: 'defineVocabulary',   label: 'Define vocabulary', providers: ['qwen', 'deepseek', 'openai', 'disabled'] },
      { key: 'explainWhyItMatters',label: 'Why it matters',    providers: ['qwen', 'deepseek', 'openai', 'disabled'] },
    ],
  },
  {
    label: 'Scoring',
    capabilities: [
      { key: 'scoreChunkParaphrase',        label: 'Score reading part',       providers: ['qwen', 'deepseek', 'openai', 'disabled'] },
      { key: 'scoreFinalSummary',           label: 'Score final summary',      providers: ['qwen', 'deepseek', 'openai', 'disabled'] },
      { key: 'generateGapAwareExplanation', label: 'Explain again (low score)',providers: ['qwen', 'deepseek', 'openai', 'disabled'] },
    ],
  },
  {
    label: 'Audio & Input',
    capabilities: [
      { key: 'transcribeSpeech',    label: 'Speech transcription', providers: ['qwen', 'openai', 'disabled'] },
      { key: 'generateSpeech',      label: 'Text-to-speech',       providers: ['qwen', 'openai', 'browserTts', 'disabled'] },
      { key: 'extractTextFromImage',label: 'Image text extraction',providers: ['qwen', 'openai', 'disabled'] },
    ],
  },
];

interface AiRoutingSettingsProps {
  preferences: AiRoutingPreferences;
  onSave: (preferences: AiRoutingPreferences) => void;
  isSaving?: boolean;
}

interface RoutingRowProps {
  label: string;
  capability: AiCapability;
  providers: AiProvider[];
  value: AiProvider;
  onChange: (provider: AiProvider) => void;
}

function RoutingRow({ label, capability, providers, value, onChange }: RoutingRowProps) {
  return (
    <div className="routing-row">
      <label className="routing-row-label" htmlFor={`routing-${capability}`}>
        {label}
      </label>
      <select
        id={`routing-${capability}`}
        value={value}
        onChange={(e) => onChange(e.target.value as AiProvider)}
      >
        {providers.map((p) => (
          <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
        ))}
      </select>
    </div>
  );
}

export function AiRoutingSettings({ preferences, onSave, isSaving = false }: AiRoutingSettingsProps) {
  const [local, setLocal] = useState<AiRoutingPreferences>(preferences);

  useEffect(() => {
    setLocal(preferences);
  }, [preferences]);

  const hasChanges = (Object.keys(preferences) as AiCapability[]).some(
    (k) => preferences[k] !== local[k]
  );

  function handleChange(capability: AiCapability, provider: AiProvider) {
    setLocal((prev) => ({ ...prev, [capability]: provider }));
  }

  return (
    <section aria-label="AI routing settings" className="settings-card">
      <div className="section-heading">
        <h2>AI Provider Routing</h2>
        <p>Choose which AI provider handles each capability.</p>
      </div>

      <div className="routing-groups">
        {GROUPS.map((group) => (
          <div key={group.label} className="routing-group">
            <p className="routing-group-label">{group.label}</p>
            {group.capabilities.map(({ key, label, providers }) => (
              <RoutingRow
                key={key}
                capability={key}
                label={label}
                providers={providers}
                value={local[key]}
                onChange={(provider) => handleChange(key, provider)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="routing-fallback">
        <RoutingRow
          capability="fallback"
          label="Fallback provider"
          providers={['qwen', 'deepseek', 'openai', 'disabled']}
          value={local.fallback}
          onChange={(provider) => handleChange('fallback', provider)}
        />
        <p className="threshold-desc" style={{ marginTop: 8 }}>
          Used when the primary provider fails. Set this to a different provider than your primary.
        </p>
      </div>

      <button
        type="button"
        className="primary-button settings-save-btn"
        disabled={isSaving || !hasChanges}
        onClick={() => onSave(local)}
      >
        {isSaving ? 'Saving…' : 'Save AI Routing'}
      </button>
    </section>
  );
}
