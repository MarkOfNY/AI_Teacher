import { useMemo, useState } from 'react';
import { HelpPopover } from './HelpPopover';

interface SelectableTextProps {
  text: string;
  onDefine?: (selectedText: string) => void;
  textClassName?: string;
}

interface SelectionRange {
  start: number;
  end: number;
}

function cleanToken(token: string) {
  return token.replace(/[^\w'-]/g, '');
}

export function SelectableText({ text, onDefine, textClassName }: SelectableTextProps) {
  const tokens = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const [selection, setSelection] = useState<SelectionRange | null>(null);

  const selectedText = selection
    ? tokens.slice(selection.start, selection.end + 1).map(cleanToken).join(' ')
    : '';

  function handleTokenClick(index: number) {
    setSelection((currentSelection) => {
      if (currentSelection && index >= currentSelection.start && index <= currentSelection.end) {
        return null;
      }

      return currentSelection;
    });
  }

  return (
    <div>
      <p className={textClassName}>
        {tokens.map((token, index) => {
          const display = cleanToken(token);
          const selected = selection !== null && index >= selection.start && index <= selection.end;
          return (
            <span key={`${token}-${index}`}>
              <button
                type="button"
                aria-label={display}
                data-selected={selected ? 'true' : 'false'}
                onClick={() => handleTokenClick(index)}
                onDoubleClick={() => setSelection({ start: index, end: index })}
              >
                {token}
              </button>{' '}
            </span>
          );
        })}
      </p>
      {selection ? (
        <HelpPopover
          selectedText={selectedText}
          onExpandLeft={() => setSelection((current) => current ? { ...current, start: Math.max(0, current.start - 1) } : current)}
          onExpandRight={() => setSelection((current) => current ? { ...current, end: Math.min(tokens.length - 1, current.end + 1) } : current)}
          onDefine={() => onDefine?.(selectedText)}
        />
      ) : null}
    </div>
  );
}
