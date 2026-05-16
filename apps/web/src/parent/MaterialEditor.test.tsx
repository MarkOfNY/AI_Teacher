import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MaterialEditor } from './MaterialEditor';

const materialsApi = vi.hoisted(() => ({
  extractFile: vi.fn(),
}));
vi.mock('../api/materialsClient', () => materialsApi);

describe('MaterialEditor', () => {
  it('creates a lesson without submitting pasted text into the URL', async () => {
    const onCreateMaterial = vi.fn();
    render(<MaterialEditor onCreateMaterial={onCreateMaterial} />);

    await userEvent.type(screen.getByLabelText('Title'), 'Declaration of Independence');
    await userEvent.type(screen.getByLabelText('Material text'), 'When in the Course of human events...');
    await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }));

    expect(onCreateMaterial).toHaveBeenCalledWith({
      title: 'Declaration of Independence',
      originalText: 'When in the Course of human events...'
    });
  });

  it('edits a lesson with prefilled title and material text', async () => {
    const onUpdateMaterial = vi.fn();
    render(
      <MaterialEditor
        editingMaterial={{
          id: 'material_1',
          title: 'Old title',
          originalText: 'Old lesson text.'
        }}
        onUpdateMaterial={onUpdateMaterial}
      />
    );

    expect(screen.getByRole('heading', { name: 'Edit Lesson' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Old title');
    expect(screen.getByLabelText('Material text')).toHaveValue('Old lesson text.');

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'New title');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onUpdateMaterial).toHaveBeenCalledWith({
      materialId: 'material_1',
      title: 'New title',
      originalText: 'Old lesson text.'
    });
  });

  it('does not ask for reading parts before the lesson is created', () => {
    render(<MaterialEditor />);

    expect(screen.queryByLabelText('Number of Reading Parts')).not.toBeInTheDocument();
  });

  it('loads pasted material from an uploaded text file', async () => {
    materialsApi.extractFile.mockResolvedValue({ text: 'The Declaration was adopted in 1776.' });
    render(<MaterialEditor />);
    const file = new File([''], 'declaration.pdf', { type: 'application/pdf' });

    await userEvent.upload(screen.getByLabelText('Upload file'), file);

    await waitFor(() => {
      expect(screen.getByLabelText('Material text')).toHaveValue('The Declaration was adopted in 1776.');
    });
    expect(screen.getByLabelText('Title')).toHaveValue('declaration');
  });
});
