import type { Editor } from '@tiptap/react';
import { EditorContent } from '@tiptap/react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight,
  Bold, Heading1, Heading2, Heading3,
  Italic, List, ListOrdered, Minus,
  Redo2, TextQuote, Underline, Undo2
} from 'lucide-react';

interface Props {
  editor: Editor | null;
}

interface ToolbarBtnProps {
  label: string;
  active: boolean;
  disabled?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

function ToolbarBtn({ label, active, disabled = false, onMouseDown, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      className={`rte-toolbar-btn${active ? ' is-active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={onMouseDown}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="rte-toolbar-divider" aria-hidden="true" />;
}

export function RichTextEditor({ editor }: Props) {
  const cmd = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };

  return (
    <div className="rte-wrapper">
      <div className="rte-toolbar" role="toolbar" aria-label="Text formatting">

        {/* Undo / Redo */}
        <ToolbarBtn label="Undo" active={false} disabled={!editor?.can().undo()}
          onMouseDown={cmd(() => editor?.chain().focus().undo().run())}>
          <Undo2 size={14} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Redo" active={false} disabled={!editor?.can().redo()}
          onMouseDown={cmd(() => editor?.chain().focus().redo().run())}>
          <Redo2 size={14} aria-hidden="true" />
        </ToolbarBtn>

        <Divider />

        {/* Inline marks */}
        <ToolbarBtn label="Bold" active={editor?.isActive('bold') ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().toggleBold().run())}>
          <Bold size={14} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Italic" active={editor?.isActive('italic') ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().toggleItalic().run())}>
          <Italic size={14} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Underline" active={editor?.isActive('underline') ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().toggleUnderline().run())}>
          <Underline size={14} aria-hidden="true" />
        </ToolbarBtn>

        <Divider />

        {/* Headings */}
        <ToolbarBtn label="Heading 1" active={editor?.isActive('heading', { level: 1 }) ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}>
          <Heading1 size={15} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Heading 2" active={editor?.isActive('heading', { level: 2 }) ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}>
          <Heading2 size={15} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Heading 3" active={editor?.isActive('heading', { level: 3 }) ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().toggleHeading({ level: 3 }).run())}>
          <Heading3 size={15} aria-hidden="true" />
        </ToolbarBtn>

        <Divider />

        {/* Alignment */}
        <ToolbarBtn label="Align left" active={editor?.isActive({ textAlign: 'left' }) ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().setTextAlign('left').run())}>
          <AlignLeft size={14} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Align center" active={editor?.isActive({ textAlign: 'center' }) ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().setTextAlign('center').run())}>
          <AlignCenter size={14} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Align right" active={editor?.isActive({ textAlign: 'right' }) ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().setTextAlign('right').run())}>
          <AlignRight size={14} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Justify" active={editor?.isActive({ textAlign: 'justify' }) ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().setTextAlign('justify').run())}>
          <AlignJustify size={14} aria-hidden="true" />
        </ToolbarBtn>

        <Divider />

        {/* Lists */}
        <ToolbarBtn label="Bullet list" active={editor?.isActive('bulletList') ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().toggleBulletList().run())}>
          <List size={15} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Numbered list" active={editor?.isActive('orderedList') ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().toggleOrderedList().run())}>
          <ListOrdered size={15} aria-hidden="true" />
        </ToolbarBtn>

        <Divider />

        {/* Block-level extras */}
        <ToolbarBtn label="Block quote" active={editor?.isActive('blockquote') ?? false}
          onMouseDown={cmd(() => editor?.chain().focus().toggleBlockquote().run())}>
          <TextQuote size={15} aria-hidden="true" />
        </ToolbarBtn>
        <ToolbarBtn label="Horizontal rule" active={false}
          onMouseDown={cmd(() => editor?.chain().focus().setHorizontalRule().run())}>
          <Minus size={14} aria-hidden="true" />
        </ToolbarBtn>

      </div>
      <div className="rte-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
