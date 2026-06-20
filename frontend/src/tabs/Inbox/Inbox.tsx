import { useState, useEffect, FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { InboxItem, UnifiedItem } from '@/types';
import { TaskBadges } from '@/components/TaskBadges/TaskBadges';
import { playCompletionFeedback } from '@/utils/audioUtils';
import { obsidianFileHref } from '@/utils/textUtils';
import { TaskModal } from '@/components/TaskModal/TaskModal';

function inboxToUnified(item: InboxItem): UnifiedItem {
  return {
    id: item.id,
    raw_line: item.raw_line,
    rel_path: item.rel_path ?? '',
    description: item.description ?? '',
    due: item.due,
    scheduled: item.scheduled,
    start: item.start,
    time: item.time,
    recur: item.recur,
    tags: item.tags,
  };
}

interface InboxResponse {
  items: InboxItem[];
  inbox_rel_path: string;
}

interface Props {
  onBadgeCount?: (n: number) => void;
}

export function Inbox({ onBadgeCount }: Props) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery<InboxResponse>({
    queryKey: ['inbox-items'],
    queryFn: async () => {
      const res = await fetch('/inbox-items');
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const [filter, setFilter] = useState('');
  const [sortNewest, setSortNewest] = useState(true);
  const [processingMode, setProcessingMode] = useState(() => localStorage.getItem('inboxProcessingMode') === '1');
  const [processingStartCount, setProcessingStartCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Quick add state
  const [quickInput, setQuickInput] = useState('');
  const [remindCheck, setRemindCheck] = useState(false);
  const [remindTime, setRemindTime] = useState('');
  const [quickFeedback, setQuickFeedback] = useState('');
  const [quickFeedbackOk, setQuickFeedbackOk] = useState(false);

  const items = data?.items ?? [];
  const inboxRelPath = data?.inbox_rel_path ?? '';

  useEffect(() => { onBadgeCount?.(items.length); }, [items.length]);

  function getFilteredSorted(): InboxItem[] {
    const q = filter.toLowerCase();
    let result = [...items];
    if (q) result = result.filter(i => i.description.toLowerCase().includes(q) || i.tags.some(t => t.toLowerCase().includes(q)));
    if (sortNewest) result = result.reverse();
    return result;
  }

  function getNextItemId(currentId: string): string | null {
    const sorted = getFilteredSorted();
    const idx = sorted.findIndex(i => i.id === currentId);
    if (idx === -1 || sorted.length <= 1) return null;
    return idx < sorted.length - 1 ? sorted[idx + 1].id : sorted[idx - 1].id;
  }

  function toggleProcessing() {
    const next = !processingMode;
    setProcessingMode(next);
    localStorage.setItem('inboxProcessingMode', next ? '1' : '0');
    if (next) setProcessingStartCount(items.length);
  }

  async function onQuickAdd(e: FormEvent) {
    e.preventDefault();
    setQuickFeedback('');
    let description = quickInput;
    if (remindCheck && remindTime) description += ` #remind @${remindTime}`;
    const res = await fetch('/inbox/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    const d = await res.json();
    if (res.ok) {
      setQuickFeedbackOk(true);
      setQuickFeedback('Added to inbox.');
      setQuickInput('');
      setRemindCheck(false);
      setRemindTime('');
      qc.invalidateQueries({ queryKey: ['inbox-items'] });
    } else {
      setQuickFeedbackOk(false);
      setQuickFeedback(d.error ?? 'Error.');
    }
  }

  async function completeItem(id: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const nextId = getNextItemId(id);
    const res = await fetch('/inbox/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_line: item.raw_line }),
    });
    if (res.ok) {
      playCompletionFeedback();
      qc.invalidateQueries({ queryKey: ['inbox-items'] });
      if (processingMode && nextId) setSelectedId(nextId);
    } else {
      const d = await res.json();
      alert(d.error ?? 'Failed.');
    }
  }

  function afterAction(nextId: string | null) {
    if (processingMode && nextId) setSelectedId(nextId);
    else setSelectedId(null);
  }

  const filtered = getFilteredSorted();
  const selectedItem = selectedId ? items.find(i => i.id === selectedId) : null;
  const count = items.length;

  const progressTitle = processingMode && processingStartCount
    ? `${processingStartCount - count} / ${processingStartCount}`
    : undefined;

  return (
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <h2>Add to Inbox</h2>
        <form onSubmit={onQuickAdd}>
          <div className="form-row">
            <input type="text" value={quickInput} onChange={e => setQuickInput(e.target.value)} placeholder="Task description…" required />
            <button type="submit" title="Add">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          </div>
          <div className="inbox-remind-row">
            <label className="inbox-remind-label">
              <input type="checkbox" className="task-checkbox" checked={remindCheck} onChange={e => { setRemindCheck(e.target.checked); if (!e.target.checked) setRemindTime(''); }} />
              <span>Remind at</span>
            </label>
            <input
              type="time"
              value={remindTime}
              disabled={!remindCheck}
              onChange={e => setRemindTime(e.target.value)}
              style={{ opacity: remindCheck ? 1 : 0.4, transition: 'opacity 0.15s' }}
            />
          </div>
          <div className={`feedback${quickFeedbackOk ? ' ok' : quickFeedback ? ' err' : ''}`}>{quickFeedback}</div>
        </form>
      </div>

      <div className="card">
        <div className="tasks-header">
          <h2>
            Inbox
            {count > 0 && <span className="inbox-count-badge">{count}</span>}
          </h2>
          <div className="inbox-header-actions">
            <button className="refresh-btn" onClick={() => setSortNewest(p => !p)}>{sortNewest ? '↓' : '↑'}</button>
            <button
              className={`refresh-btn${processingMode ? ' inbox-process-btn--active' : ''}`}
              onClick={toggleProcessing}
              title="Processing mode"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            </button>
            {inboxRelPath && (
              <button className="refresh-btn inbox-obsidian-btn" onClick={() => { window.location.href = obsidianFileHref(inboxRelPath); }} title="Open in Obsidian">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="inbox-search-row">
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search inbox…" />
        </div>

        {isLoading && <div className="empty-state"><span className="spinner" /> Loading…</div>}
        {isError   && <div className="empty-state" style={{ color: 'var(--danger)' }}>Failed to load inbox.</div>}
        {!isLoading && !isError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.length === 0 ? (
              <div className="empty-state">{filter ? 'No items match your search.' : 'Inbox is empty. 🎉'}</div>
            ) : filtered.map(item => (
              <div key={item.id} className="task-item inbox-item">
                <input type="checkbox" className="task-checkbox" title="Complete and move to tasks" onChange={() => completeItem(item.id)} />
                <div className="task-body" style={{ cursor: 'pointer' }} onClick={() => setSelectedId(item.id)}>
                  <div className="task-text">
                    {item.description || <span style={{ color: 'var(--text-muted)' }}>(no description)</span>}
                  </div>
                  <div className="task-meta">
                    <TaskBadges task={{ task: '', rel_path: '', file: '', top_folder: '', due: item.due, scheduled: item.scheduled, start: item.start, time: item.time, recur: item.recur, tags: item.tags }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <TaskModal
          item={inboxToUnified(selectedItem)}
          source="inbox"
          allItems={filtered.map(inboxToUnified)}
          onNavigate={id => setSelectedId(id)}
          onClose={() => setSelectedId(null)}
          onAction={afterAction}
          processingTitle={progressTitle}
        />
      )}
    </div>
  );
}
