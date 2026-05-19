import { useEffect, useRef, useState } from 'react';

interface SelectableTextProps {
  text: string;
  onDefine?: (selectedText: string) => void;
  textClassName?: string;
}

interface BubbleState {
  text: string;
  x: number;
  y: number;
}

export function SelectableText({ text, onDefine, textClassName }: SelectableTextProps) {
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handlePointerUp(e: React.PointerEvent) {
    if ((e.target as Element).closest('.define-bubble')) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !containerRef.current) {
      setBubble(null);
      return;
    }

    const selectedText = sel.toString().trim();
    if (!selectedText) { setBubble(null); return; }

    const range = sel.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setBubble(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setBubble({ text: selectedText, x: rect.left + rect.width / 2, y: rect.top });
  }

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if ((e.target as Element).closest('.define-bubble')) return;
      setBubble(null);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} onPointerUp={handlePointerUp}>
      <p className={textClassName}>{text}</p>
      {bubble && onDefine ? (
        <button
          type="button"
          className="define-bubble"
          style={{ left: bubble.x, top: bubble.y }}
          aria-label={`Define "${bubble.text}"`}
          onClick={() => {
            onDefine(bubble.text);
            setBubble(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          ?
        </button>
      ) : null}
    </div>
  );
}
