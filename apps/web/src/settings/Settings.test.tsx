import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROUTING_PREFERENCES } from '@ai-teacher/shared';
import { AiRoutingSettings } from './AiRoutingSettings';
import { MasterySettings } from './MasterySettings';

describe('settings', () => {
  it('shows separate reading part and final summary thresholds', () => {
    render(<MasterySettings chunkMasteryThreshold={85} finalSummaryMasteryThreshold={90} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/reading part/i)).toHaveValue('85');
    expect(screen.getByLabelText(/final summary/i)).toHaveValue('90');
  });

  it('shows routing controls for key capabilities', () => {
    render(<AiRoutingSettings preferences={DEFAULT_ROUTING_PREFERENCES} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/simplify text/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/speech transcription/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/text-to-speech/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/image text extraction/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fallback provider/i)).toBeInTheDocument();
  });
});
