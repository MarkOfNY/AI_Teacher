import type { Editor } from '@tiptap/react';
import { EditorContent } from '@tiptap/react';
import { Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered } from 'lucide-react';

interface Props {
  editor: Editor | null;
}

export function RichTextEditor({ editor }: Props) {
  return (
    <div className="rte-wrapper">
      <div className="rte-toolbar" aria-label="Text formatting">
        <button
          type="button"
          className={`rte-toolbar-btn${editor?.isActive('bold') ? ' is-active' : ''}`}
          aria-label="Bold"
          aria-pressed={editor?.isActive('bold') ?? false}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }}
        >
          <Bold size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`rte-toolbar-btn${editor?.isActive('italic') ? ' is-active' : ''}`}
          aria-label="Italic"
          aria-pressed={editor?.isActive('italic') ?? false}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }}
        >
          <Italic size={14} aria-hidden="true" />
        </button>
        <div className="rte-toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className={`rte-toolbar-btn${editor?.isActive('heading', { level: 1 }) ? ' is-active' : ''}`}
          aria-label="Heading 1"
          aria-pressed={editor?.isActive('heading', { level: 1 }) ?? false}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleHeading({ level: 1 }).run(); }}
        >
          <Heading1 size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`rte-toolbar-btn${editor?.isActive('heading', { level: 2 }) ? ' is-active' : ''}`}
          aria-label="Heading 2"
          aria-pressed={editor?.isActive('heading', { level: 2 }) ?? false}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleHeading({ level: 2 }).run(); }}
        >
          <Heading2 size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`rte-toolbar-btn${editor?.isActive('heading', { level: 3 }) ? ' is-active' : ''}`}
          aria-label="Heading 3"
          aria-pressed={editor?.isActive('heading', { level: 3 }) ?? false}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleHeading({ level: 3 }).run(); }}
        >
          <Heading3 size={15} aria-hidden="true" />
        </button>
        <div className="rte-toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className={`rte-toolbar-btn${editor?.isActive('bulletList') ? ' is-active' : ''}`}
          aria-label="Bullet list"
          aria-pressed={editor?.isActive('bulletList') ?? false}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run(); }}
        >
          <List size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`rte-toolbar-btn${editor?.isActive('orderedList') ? ' is-active' : ''}`}
          aria-label="Numbered list"
          aria-pressed={editor?.isActive('orderedList') ?? false}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run(); }}
        >
          <ListOrdered size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="rte-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
