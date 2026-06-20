import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedItem, ItemSource } from '@/types';
import { buildTaskLine } from '@/utils/taskUtils';
import { obsidianFileHref } from '@/utils/textUtils';
import { playCompletionFeedback } from '@/utils/audioUtils';
import { TagInput } from '@/components/TagInput/TagInput';
import { VaultFileInput } from '@/components/VaultFileInput/VaultFileInput';

const RECUR_OPTIONS = ['', 'every 2 days', 'every week', 'every 2 weeks', 'every 3 weeks', 'every month'];

interface Props {
  item: UnifiedItem;
  source: ItemSource;
  onClose: () => void;
  allItems?: UnifiedItem[];
  onNavigate?: (id: string) => void;
  onAction?: (nextId: string | null) => void;
  processingTitle?: string;
}

export function TaskModal({ item, source, onClose, allItems, onNavigate, onAction, processingTitle }: Props) {
  const qc = useQueryClient();

  const [description, setDescription] = useState(item.description ?? '');
  const [due, setDue] = useState(item.due ?? '');
  const [scheduled, setScheduled] = useState(item.scheduled ?? '');
  const [start, setStart] = useState(item.start ?? '');
  const [time, setTime] = useState(item.time ?? '');
  const [recur, setRecur] = useState(item.recur ?? '');
  const [target, setTarget] = useState('');
  const [tags, setTags] = useState<string[]>(item.tags ?? []);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (descRef.current) {
        descRef.current.style.height = 'auto';
        descRef.current.style.height = descRef.current.scrollHeight + 'px';
        descRef.current.focus();
      }
    }, 50);

    function onViewportResize() {
      const el = document.activeElement;
      if (el instanceof HTMLElement) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      }
    }
    window.visualViewport?.addEventListener('resize', onViewportResize);
    return () => window.visualViewport?.removeEventListener('resize', onViewportResize);
  }, []);

  useEffect(() => {
    setDescription(item.description ?? '');
    setDue(item.due ?? '');
    setScheduled(item.scheduled ?? '');
    setStart(item.start ?? '');
    setTime(item.time ?? '');
    setRecur(item.recur ?? '');
    setTarget('');
    setTags(item.tags ?? []);
    setTimeout(() => {
      if (descRef.current) {
        descRef.current.style.height = 'auto';
        descRef.current.style.height = descRef.current.scrollHeight + 'px';
        descRef.current.focus();
      }
    }, 50);
  }, [item.id]);

  function buildLine() {
    return buildTaskLine({ description, tags, due, scheduled, start, time, recur });
  }

  function invalidate() {
    if (source === 'inbox')    qc.invalidateQueries({ queryKey: ['inbox-items'] });
    if (source === 'today')    qc.invalidateQueries({ queryKey: ['today-tasks'] });
    if (source === 'next')     qc.invalidateQueries({ queryKey: ['next-tasks'] });
    if (source === 'upcoming') qc.invalidateQueries({ queryKey: ['upcoming-tasks'] });
  }

  function nextId(): string | null {
    if (!allItems) return null;
    const idx = allItems.findIndex(i => i.id === item.id);
    if (idx === -1 || allItems.length <= 1) return null;
    return idx < allItems.length - 1 ? allItems[idx + 1].id : allItems[idx - 1].id;
  }

  function afterSuccess(withFeedback = false) {
    if (withFeedback) playCompletionFeedback();
    invalidate();
    if (onAction) onAction(nextId());
    else onClose();
  }

  async function onSave() {
    const res = await fetch('/item/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, raw_line: item.raw_line, new_line: buildLine(), rel_path: item.rel_path, target_path: target }),
    });
    if (res.ok) afterSuccess();
    else { const d = await res.json(); alert(d.error ?? 'Failed.'); }
  }

  async function onDone() {
    const res = await fetch('/item/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, raw_line: item.raw_line, new_line: buildLine(), rel_path: item.rel_path, target_path: target }),
    });
    if (res.ok) afterSuccess(true);
    else { const d = await res.json(); alert(d.error ?? 'Failed.'); }
  }

  async function onDelete() {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    const res = await fetch('/item/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, raw_line: item.raw_line, rel_path: item.rel_path }),
    });
    if (res.ok) afterSuccess();
    else { const d = await res.json(); alert(d.error ?? 'Failed.'); }
  }

  const currentIdx = allItems?.findIndex(i => i.id === item.id) ?? -1;
  const hasPrev = currentIdx > 0;
  const hasNext = allItems !== undefined && currentIdx < allItems.length - 1;

  function onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    const id  = (e.target as HTMLElement).id;
    if (e.key === 'ArrowRight' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
      e.preventDefault(); if (hasNext) onNavigate?.(allItems![currentIdx + 1].id); return;
    }
    if (e.key === 'ArrowLeft' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
      e.preventDefault(); if (hasPrev) onNavigate?.(allItems![currentIdx - 1].id); return;
    }
    if (e.key === 'Enter') {
      if (tag === 'textarea' || tag === 'select') return;
      if (id === 'tm-tag-input' || id === 'tm-target') return;
      e.preventDefault();
      onSave();
    }
  }

  const title = processingTitle ?? (source === 'inbox' ? 'Inbox Item' : 'Edit Task');

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="task-modal-overlay" />
        <Dialog.Content
          className="task-modal-content"
          aria-describedby={undefined}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <div className="task-modal-handle" aria-hidden />
          <div className="task-modal-scroll" onKeyDown={onKeyDown}>

            {/* Header */}
            <div className="inbox-modal-header">
              <span className="inbox-modal-title">{title}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {item.rel_path && (
                  <button
                    className="refresh-btn inbox-obsidian-btn"
                    title="Open in Obsidian"
                    onClick={() => { window.location.href = obsidianFileHref(item.rel_path); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </button>
                )}
                {allItems && (
                  <>
                    <button className="inbox-close-btn" onClick={() => hasPrev && onNavigate?.(allItems[currentIdx - 1].id)} disabled={!hasPrev} title="Previous">←</button>
                    <button className="inbox-close-btn" onClick={() => hasNext && onNavigate?.(allItems[currentIdx + 1].id)} disabled={!hasNext} title="Next">→</button>
                  </>
                )}
                <Dialog.Close asChild>
                  <button className="inbox-close-btn" title="Close">✕</button>
                </Dialog.Close>
              </div>
            </div>

            {/* Description */}
            <div className="inbox-field">
              <label className="inbox-label">Task</label>
              <textarea
                ref={descRef}
                id="tm-description"
                className="inbox-textarea"
                rows={2}
                placeholder="Task description…"
                dir="auto"
                value={description}
                onChange={e => {
                  setDescription(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
              />
            </div>

            {/* Date fields */}
            <div className="inbox-fields-row">
              {([
                { id: 'tm-due',       label: '📅 Due',       value: due,       set: setDue },
                { id: 'tm-scheduled', label: '⏳ Scheduled', value: scheduled, set: setScheduled },
                { id: 'tm-start',     label: '🛫 Start',     value: start,     set: setStart },
              ] as const).map(({ id, label, value, set }) => (
                <div key={id} className="inbox-field">
                  <label className="inbox-label">{label}</label>
                  <div className="date-field-row">
                    <input id={id} type="date" className="inbox-date-input" value={value} onChange={e => set(e.target.value)} onBlur={e => { const el = e.target; setTimeout(() => { if (el.value !== value) set(el.value); }, 0); }} />
                    {value && <button type="button" className="date-clear-btn" onClick={() => set('')}>×</button>}
                  </div>
                </div>
              ))}
            </div>

            {/* Time + Recurrence */}
            <div className="inbox-fields-row inline">
              <div className="inbox-field">
                <label className="inbox-label">@ Time</label>
                <div className="date-field-row">
                  <input id="tm-time" type="time" value={time} onChange={e => setTime(e.target.value)} onBlur={e => { const el = e.target; setTimeout(() => { if (el.value !== time) setTime(el.value); }, 0); }} />
                  {time && <button type="button" className="date-clear-btn" onClick={() => setTime('')}>×</button>}
                </div>
              </div>
              <div className="inbox-field" style={{ flex: 2 }}>
                <label className="inbox-label">🔁 Recurrence</label>
                <select value={recur} onChange={e => setRecur(e.target.value)}>
                  {RECUR_OPTIONS.map(o => <option key={o} value={o}>{o || 'None'}</option>)}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="inbox-field">
              <label className="inbox-label">Tags</label>
              <TagInput tags={tags} onChange={setTags} inputId="tm-tag-input" />
            </div>

            {/* Move to page */}
            <div className="inbox-field" style={{ position: 'relative' }}>
              <label className="inbox-label">
                Move to page{' '}
                <span className="inbox-label-hint">
                  {source === 'inbox' ? '(empty → Imploding Tasks on Done)' : '(empty → save in current file)'}
                </span>
              </label>
              <VaultFileInput id="tm-target" value={target} onChange={setTarget} placeholder="Start typing a page name…" />
            </div>

            {/* Actions */}
            <div className="inbox-modal-actions">
              <button className="inbox-btn-danger" onClick={onDelete} title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="inbox-btn-secondary" onClick={onSave} title="Save">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                </button>
                <button className="inbox-btn-primary" onClick={onDone} title="Done ✓">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
