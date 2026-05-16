import { useEffect, useState } from 'react';

interface MasterySettingsProps {
  chunkMasteryThreshold: number;
  finalSummaryMasteryThreshold: number;
  onSave: (input: { chunkMasteryThreshold: number; finalSummaryMasteryThreshold: number }) => void;
  isSaving?: boolean;
}

interface ThresholdSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}

function ThresholdSlider({ label, description, value, onChange }: ThresholdSliderProps) {
  return (
    <div className="threshold-field">
      <div className="threshold-field-header">
        <span className="threshold-label">{label}</span>
        <span className="threshold-value">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="threshold-slider"
        aria-label={`${label} — ${value}%`}
      />
      <div className="threshold-track-labels" aria-hidden="true">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      <p className="threshold-desc">{description}</p>
    </div>
  );
}

export function MasterySettings({
  chunkMasteryThreshold,
  finalSummaryMasteryThreshold,
  onSave,
  isSaving = false
}: MasterySettingsProps) {
  const [chunkValue, setChunkValue] = useState(chunkMasteryThreshold);
  const [finalValue, setFinalValue] = useState(finalSummaryMasteryThreshold);

  useEffect(() => {
    setChunkValue(chunkMasteryThreshold);
    setFinalValue(finalSummaryMasteryThreshold);
  }, [chunkMasteryThreshold, finalSummaryMasteryThreshold]);

  const hasChanges = chunkValue !== chunkMasteryThreshold || finalValue !== finalSummaryMasteryThreshold;

  return (
    <section aria-label="Mastery settings" className="settings-card">
      <div className="section-heading">
        <h2>Mastery Thresholds</h2>
        <p>Minimum score the student must reach before moving on.</p>
      </div>

      <ThresholdSlider
        label="Reading part"
        description="Student must explain each reading part at this level before unlocking the next one."
        value={chunkValue}
        onChange={setChunkValue}
      />

      <ThresholdSlider
        label="Final summary"
        description="Student must summarize the full material at this level to complete the lesson."
        value={finalValue}
        onChange={setFinalValue}
      />

      <button
        type="button"
        className="primary-button settings-save-btn"
        disabled={isSaving || !hasChanges}
        onClick={() => onSave({ chunkMasteryThreshold: chunkValue, finalSummaryMasteryThreshold: finalValue })}
      >
        {isSaving ? 'Saving…' : 'Save Thresholds'}
      </button>
    </section>
  );
}
