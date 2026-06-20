import { useState, useRef, KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useVaultTags } from '@/hooks/useVaultTags';
import { tagBadgeClass } from '@/utils/taskUtils';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  inputId?: string;
}

export function TagInput({ tags, onChange, inputId }: Props) {
  const { data: allTags = [] } = useVaultTags();
  const [inputVal, setInputVal] = useState('');
  const [matches, setMatches] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function filterTags(val: string) {
    const q = val.replace(/^#+/, '').toLowerCase();
    if (!q) { setDropdownOpen(false); return; }
    const m = allTags.filter(t => t.slice(1).toLowerCase().includes(q)).slice(0, 10);
    setMatches(m);
    setActiveIdx(-1);
    setDropdownOpen(m.length > 0);
  }

  function addTag(tag: string) {
    if (!tags.includes(tag)) onChange([...tags, tag]);
    setInputVal('');
    setDropdownOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  function removeTag(i: number) {
    onChange(tags.filter((_, idx) => idx !== i));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (dropdownOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, matches.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); addTag(matches[activeIdx]); return; }
      if (e.key === 'Escape') { e.stopPropagation(); setDropdownOpen(false); return; }
    }
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = inputVal.trim().replace(/^#+/, '');
      if (val) addTag('#' + val);
    }
  }

  return (
    <Popover.Root open={dropdownOpen} modal={false}>
      <Popover.Anchor asChild>
        <div className="inbox-tags-container">
          {tags.map((tag, i) => (
            <span key={i} className={`badge ${tagBadgeClass(tag)} inbox-tag-chip`}>
              {tag}
              <button className="inbox-tag-remove" type="button" onClick={() => removeTag(i)}>×</button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            className="inbox-tag-input"
            placeholder="Add tag…"
            value={inputVal}
            onChange={e => { setInputVal(e.target.value); filterTags(e.target.value); }}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
            onKeyDown={onKeyDown}
          />
        </div>
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
          {matches.map((t, i) => (
            <div
              key={t}
              className={`vault-file-option${i === activeIdx ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); addTag(t); }}
            >
              {t}
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
