import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { ParentDashboard } from './ParentDashboard';

describe('ParentDashboard', () => {
  it('shows material history with completion state and missing final score', () => {
    render(<ParentDashboard materials={[{ id: 'm1', title: 'History', status: 'inProgress', finalBestScore: null }]} />);
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('No final score')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit History' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete History' })).toBeEnabled();
  });

  it('calls edit and delete handlers from material actions', async () => {
    const onEditMaterial = vi.fn();
    const onDeleteMaterial = vi.fn();
    render(
      <ParentDashboard
        materials={[{ id: 'm1', title: 'History', status: 'inProgress', finalBestScore: null }]}
        onEditMaterial={onEditMaterial}
        onDeleteMaterial={onDeleteMaterial}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Edit History' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete History' }));

    expect(onEditMaterial).toHaveBeenCalledWith('m1');
    expect(onDeleteMaterial).toHaveBeenCalledWith('m1');
  });

  it('shows completed material final score', () => {
    render(<ParentDashboard materials={[{ id: 'm2', title: 'Science', status: 'complete', finalBestScore: 93 }]} />);
    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('93%')).toBeInTheDocument();
  });
});
