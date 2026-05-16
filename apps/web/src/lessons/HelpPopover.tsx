interface HelpPopoverProps {
  selectedText: string;
  onExpandLeft: () => void;
  onExpandRight: () => void;
  onDefine?: () => void;
}

export function HelpPopover({ selectedText, onExpandLeft, onExpandRight, onDefine }: HelpPopoverProps) {
  return (
    <div role="dialog" aria-label={`Help for ${selectedText}`} className="selection-help-popover">
      <button type="button" onClick={onExpandLeft}>Expand Left</button>
      <button type="button" onClick={onExpandRight}>Expand Right</button>
      <button type="button" onClick={onDefine}>Define</button>
    </div>
  );
}
