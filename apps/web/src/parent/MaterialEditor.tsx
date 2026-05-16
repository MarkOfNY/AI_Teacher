import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Image, Upload } from 'lucide-react';
import { extractFile } from '../api/materialsClient';

export interface CreateMaterialInput {
  title: string;
  originalText: string;
}

export interface EditMaterialInput {
  id: string;
  title: string;
  originalText: string;
}

export interface UpdateMaterialInput {
  materialId: string;
  title: string;
  originalText: string;
}

interface MaterialEditorProps {
  onCreateMaterial?: (input: CreateMaterialInput) => void;
  onUpdateMaterial?: (input: UpdateMaterialInput) => void;
  onCancelEdit?: () => void;
  editingMaterial?: EditMaterialInput | null;
}

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'
]);

function titleFromFileName(name: string) {
  return name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
}

export function MaterialEditor({ onCreateMaterial, onUpdateMaterial, onCancelEdit, editingMaterial = null }: MaterialEditorProps) {
  const [title, setTitle] = useState('');
  const [material, setMaterial] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [extractState, setExtractState] = useState<'idle' | 'extracting' | 'error'>('idle');
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(editingMaterial);

  useEffect(() => {
    setTitle(editingMaterial?.title ?? '');
    setMaterial(editingMaterial?.originalText ?? '');
    setExtractState('idle');
    setExtractError(null);
  }, [editingMaterial]);

  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPTED_MIME.has(file.type)) {
      setExtractError(`"${file.name}" is not a supported type. Upload a PDF, PNG, JPG, WEBP, or GIF.`);
      setExtractState('error');
      return;
    }
    setExtractState('extracting');
    setExtractError(null);
    try {
      const { text } = await extractFile(file);
      if (!text.trim()) {
        setExtractError('No text could be extracted. Try a different file or paste the text manually below.');
        setExtractState('error');
        return;
      }
      setTitle((current) => current || titleFromFileName(file.name));
      setMaterial(text);
      setExtractState('idle');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Text extraction failed. Try again or paste text manually.');
      setExtractState('error');
    }
  }, []);

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handlePaste(event: React.ClipboardEvent) {
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (imageItem) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (file) void handleFile(file);
    }
  }

  function handleZoneKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedMaterial = material.trim();
    if (!trimmedTitle || !trimmedMaterial) return;

    if (editingMaterial) {
      onUpdateMaterial?.({ materialId: editingMaterial.id, title: trimmedTitle, originalText: trimmedMaterial });
    } else {
      onCreateMaterial?.({ title: trimmedTitle, originalText: trimmedMaterial });
    }
  }

  const isExtracting = extractState === 'extracting';

  return (
    <form
      aria-label={isEditing ? 'Edit material' : 'Create material'}
      className="material-editor"
      onSubmit={handleSubmit}
      onPaste={handlePaste}
    >
      <div className="section-heading">
        <h2>{isEditing ? 'Edit Lesson' : 'Create Lesson'}</h2>
        <p>{isEditing ? 'Update the lesson title or source text.' : 'Upload a document, paste a screenshot, or type the material below.'}</p>
      </div>

      <label className="field">
        <span>Title</span>
        <input
          name="title"
          placeholder="e.g. Chapter 4 — The Water Cycle"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload file — drop a PDF or image, click to browse, or paste with Ctrl+V"
        aria-busy={isExtracting}
        className={`upload-zone${isDragOver ? ' upload-zone-drag' : ''}${isExtracting ? ' upload-zone-loading' : ''}`}
        onClick={() => !isExtracting && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleZoneKeyDown}
      >
        {isExtracting ? (
          <div className="upload-zone-body">
            <span className="loading-dot" aria-hidden="true" />
            <span className="upload-zone-label">Extracting text&hellip;</span>
          </div>
        ) : (
          <div className="upload-zone-body">
            <div className="upload-zone-icons" aria-hidden="true">
              <FileText size={28} strokeWidth={1.5} />
              <Image size={28} strokeWidth={1.5} />
            </div>
            <span className="upload-zone-label">
              Drop a file here, <span className="upload-zone-link">click to browse</span>, or paste a screenshot
            </span>
            <span className="upload-zone-hint">PDF · PNG · JPG · WEBP · GIF &nbsp;·&nbsp; up to 15 MB</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
          aria-label="Upload file"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />
      </div>

      {extractState === 'error' && extractError ? (
        <p className="upload-error" role="alert">{extractError}</p>
      ) : null}

      <label className="field">
        <span>Material text</span>
        <textarea
          name="originalText"
          placeholder="Extracted text appears here — or paste / type material directly."
          value={material}
          onChange={(event) => setMaterial(event.target.value)}
        />
      </label>

      <div className="editor-actions">
        <button className="primary-button" type="submit" disabled={!title.trim() || !material.trim() || isExtracting}>
          {isEditing ? 'Save Changes' : 'Create Lesson'}
        </button>
        {isEditing ? (
          <button type="button" className="secondary-button compact-button" onClick={onCancelEdit}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
