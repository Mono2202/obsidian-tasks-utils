import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { buildTaskLine } from '@/utils/taskUtils';
import { fmtDate } from '@/utils/dateUtils';
import { TagInput } from '@/components/TagInput/TagInput';

const RECUR_OPTIONS = ['', 'every 2 days', 'every week', 'every 2 weeks', 'every 3 weeks', 'every month'];

interface InlineTask {
  description: string;
  raw_line: string;
  due: string | null;
  scheduled: string | null;
  start: string | null;
  time: string | null;
  recur: string | null;
}

interface Props {
  relPath: string;
  file: string;
  onClose: () => void;
}

export function NextActionModal({ relPath, file, onClose }: Props) {
  const qc = useQueryClient();

  const [inlineTasks, setInlineTasks] = useState<InlineTask[]>([]);
  const [selectedRawLine, setSelectedRawLine] = useState<string | null>(null);
  const [kbIndex, setKbIndex] = useState(-1);

  const [description, setDescription] = useState('');
  const [due, setDue] = useState('');
  const [scheduled, setScheduled] = useState('');
  const [start, setStart] = useState('');
  const [time, setTime] = useState('');
  const [recur, setRecur] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/task/inline-tasks?rel_path=${encodeURIComponent(relPath)}`)
      .then(r => r.json())
      .then(d => setInlineTasks(d.tasks ?? []))
      .catch(() => {});
    descRef.current?.focus();
  }, [relPath]);

  const hasInline = selectedRawLine !== null;
  const hasNew = description.trim().length > 0;
  const canConfirm = hasInline || hasNew;

  function selectInline(i: number, rawLine: string) {
    setSelectedRawLine(rawLine);
    setKbIndex(i);
    setDescription('');
  }

  async function confirm() {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    try {
      let ok = false;
      if (selectedRawLine) {
        const res = await fetch('/task/promote-inline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rel_path: relPath, raw_line: selectedRawLine }),
        });
        ok = res.ok;
        if (!ok) { const d = await res.json(); alert(d.error ?? 'Failed.'); }
      } else {
        const res = await fetch('/task/add-next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rel_path: relPath, description: description.trim(), tags, due, scheduled, start, time, recur }),
        });
        ok = res.ok;
        if (!ok) { const d = await res.json(); alert(d.error ?? 'Failed.'); }
      }
      if (ok) {
        qc.invalidateQueries({ queryKey: ['next-tasks'] });
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter' && (e.target as HTMLElement).id !== 'na-description' && (e.target as HTMLElement).id !== 'na-tag-input') {
      e.preventDefault();
      confirm();
      return;
    }
    if (e.key === 'ArrowDown' && inlineTasks.length) {
      e.preventDefault();
      const next = Math.min(kbIndex + 1, inlineTasks.length - 1);
      selectInline(next, inlineTasks[next].raw_line);
    }
    if (e.key === 'ArrowUp' && inlineTasks.length) {
      e.preventDefault();
      if (kbIndex > 0) {
        selectInline(kbIndex - 1, inlineTasks[kbIndex - 1].raw_line);
      } else {
        setSelectedRawLine(null);
        setKbIndex(-1);
        descRef.current?.focus();
      }
    }
  }

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="task-modal-overlay" />
        <Dialog.Content className="task-modal-content" aria-describedby={undefined} onOpenAutoFocus={e => e.preventDefault()}>
          <div className="task-modal-handle" aria-hidden />
          <div className="task-modal-scroll" onKeyDown={onKeyDown}>
        <div className="inbox-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="inbox-modal-title">What's next?</span>
            <span className="badge file">{file}</span>
          </div>
          <Dialog.Close asChild><button className="inbox-close-btn">✕</button></Dialog.Close>
        </div>

        {inlineTasks.length > 0 && (
          <div>
            <label className="inbox-label" style={{ display: 'block', marginBottom: 8 }}>Inline tasks in this project</label>
            {inlineTasks.map((t, i) => (
              <button
                key={t.raw_line}
                className={`next-action-option${i === kbIndex ? ' active' : ''}`}
                onClick={() => selectInline(i, t.raw_line)}
              >
                <div className="next-action-option-text">
                  {t.description || <span style={{ color: 'var(--text-muted)' }}>(no description)</span>}
                </div>
                {(t.due || t.scheduled || t.start || t.time || t.recur) && (
                  <div className="task-meta" style={{ marginTop: 5 }}>
                    {t.due       && <span className="badge due">📅 {fmtDate(t.due)}</span>}
                    {t.scheduled && <span className="badge scheduled">⏳ {fmtDate(t.scheduled)}</span>}
                    {t.start     && <span className="badge started">🛫 {fmtDate(t.start)}</span>}
                    {t.time      && <span className="badge time">@ {t.time}</span>}
                    {t.recur     && <span className="badge recur">🔁 {t.recur}</span>}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="inbox-label" style={{ display: 'block', marginBottom: 8 }}>
            {inlineTasks.length > 0 ? 'Or add a different next task' : 'Add a next task'}
          </label>
          <div className="inbox-field">
            <textarea
              ref={descRef}
              id="na-description"
              className="inbox-textarea"
              rows={2}
              placeholder="Task description…"
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                if (e.target.value && selectedRawLine !== null) {
                  setSelectedRawLine(null);
                  setKbIndex(-1);
                }
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
            />
          </div>
          <div className="inbox-fields-row">
            {[
              { label: '📅 Due', value: due, set: setDue },
              { label: '⏳ Scheduled', value: scheduled, set: setScheduled },
              { label: '🛫 Start', value: start, set: setStart },
            ].map(({ label, value, set }) => (
              <div key={label} className="inbox-field">
                <label className="inbox-label">{label}</label>
                <input type="date" className="inbox-date-input" value={value} onChange={e => set(e.target.value)} onBlur={e => { const el = e.target; setTimeout(() => { if (el.value !== value) set(el.value); }, 0); }} />
              </div>
            ))}
          </div>
          <div className="inbox-fields-row inline" style={{ marginTop: 10 }}>
            <div className="inbox-field">
              <label className="inbox-label">@ Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} onBlur={e => { const el = e.target; setTimeout(() => { if (el.value !== time) setTime(el.value); }, 0); }} />
            </div>
            <div className="inbox-field" style={{ flex: 2 }}>
              <label className="inbox-label">🔁 Recurrence</label>
              <select value={recur} onChange={e => setRecur(e.target.value)}>
                {RECUR_OPTIONS.map(o => <option key={o} value={o}>{o || 'None'}</option>)}
              </select>
            </div>
          </div>
          <div className="inbox-field" style={{ marginTop: 10 }}>
            <label className="inbox-label">Tags</label>
            <TagInput tags={tags} onChange={setTags} inputId="na-tag-input" />
          </div>
        </div>

        <div className="inbox-modal-actions">
          <button
            className="inbox-btn-secondary"
            style={{ width: 'auto', padding: '0 16px', height: 36, fontSize: '0.85rem' }}
            onClick={onClose}
          >
            Skip
          </button>
          <button className="inbox-btn-primary" onClick={confirm} disabled={!canConfirm || submitting}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
