import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SelectableText } from './SelectableText';

describe('SelectableText', () => {
  it('selects a double-clicked word and shows only working help actions', async () => {
    render(<SelectableText text="The Stamp Act angered colonists." />);
    await userEvent.dblClick(screen.getByRole('button', { name: 'Stamp' }));

    expect(screen.getByRole('button', { name: 'Stamp' })).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: /expand left/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand right/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /define/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /explain context/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /simplify/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /why it matters/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /read aloud/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('clears the selection when the selected word is tapped again', async () => {
    render(<SelectableText text="The Stamp Act angered colonists." />);
    const stamp = screen.getByRole('button', { name: 'Stamp' });

    await userEvent.dblClick(stamp);
    expect(stamp).toHaveAttribute('data-selected', 'true');

    await userEvent.click(stamp);

    expect(stamp).toHaveAttribute('data-selected', 'false');
    expect(screen.queryByRole('dialog', { name: /help for stamp/i })).not.toBeInTheDocument();
  });

  it('keeps punctuation visible while selecting clean words', () => {
    render(<SelectableText text="This matters." />);

    expect(screen.getByRole('button', { name: 'matters' })).toHaveTextContent('matters.');
  });
});
