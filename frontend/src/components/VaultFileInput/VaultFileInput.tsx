import { useState, useRef, KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useVaultFiles } from '@/hooks/useVaultFiles';

interface Props {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function VaultFileInput({ id, value, onChange, placeholder }: Props) {
  const { data: files = [] } = useVaultFiles();
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  function filter(val: string) {
    if (!val.trim()) { setOpen(false); return; }
    const q = val.toLowerCase();
    const m = files.filter(f => f.toLowerCase().includes(q)).slice(0, 12);
    setMatches(m);
    setActiveIdx(-1);
    setOpen(true);
  }

  function select(path: string) {
    onChange(path);
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(matches[activeIdx]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
  }

  return (
    <Popover.Root open={open} modal={false}>
      <Popover.Anchor asChild>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={e => { onChange(e.target.value); filter(e.target.value); }}
          onFocus={e => filter(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={onKeyDown}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="vault-files-dropdown"
          side="bottom"
          align="start"
          sideOffset={4}
          style={{ width: 'var(--radix-popover-trigger-width)', zIndex: 2001 }}
          onOpenAutoFocus={e => e.preventDefault()}
          onPointerDownOutside={e => e.preventDefault()}
          onFocusOutside={e => e.preventDefault()}
          onTouchStart={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
          onWheel={e => e.stopPropagation()}
        >
          {matches.length > 0
            ? matches.map((f, i) => (
                <div
                  key={f}
                  className={`vault-file-option${i === activeIdx ? ' active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); select(f); }}
                >
                  {f}
                </div>
              ))
            : (
              <div
                className="vault-file-option vault-file-create"
                onMouseDown={e => { e.preventDefault(); select(value.trim()); }}
              >
                ✨ Create: {value}
              </div>
            )
          }
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
