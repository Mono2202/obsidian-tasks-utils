import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Task } from '@/types';
import { TaskBadges, taskItemClass } from '@/components/TaskBadges/TaskBadges';
import { cleanTaskText } from '@/utils/taskUtils';
import { renderLinksHtml } from '@/utils/textUtils';
import { extractTags } from '@/utils/taskUtils';
import { playCompletionFeedback, playUndoFeedback } from '@/utils/audioUtils';

interface Props {
  onEditTask: (task: Task, source: 'next' | 'upcoming') => void;
  onNextAction: (relPath: string, file: string) => void;
}

interface PlanningTaskRowProps {
  id: string;
  task: Task;
  source: 'next' | 'upcoming';
  onEdit: () => void;
  onNextAction: (relPath: string, file: string) => void;
}

function PlanningTaskRow({ id, task, source, onEdit, onNextAction }: PlanningTaskRowProps) {
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const [undoTaskId, setUndoTaskId] = useState<string | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [removing, setRemoving] = useState(false);

  async function complete() {
    const res = await fetch('/task/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel_path: task.rel_path, raw_line: task.raw_line }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Failed'); return; }
    const data = await res.json();
    playCompletionFeedback();
    setDone(true);
    setUndoTaskId(data.task_id);
    if (source === 'next') onNextAction(task.rel_path, task.file);
    const t = setTimeout(() => setRemoving(true), 5000);
    setUndoTimer(t);
  }

  async function undo() {
    if (undoTimer) clearTimeout(undoTimer);
    if (!undoTaskId) { setRemoving(true); return; }
    const res = await fetch(`/task/undo-complete/${undoTaskId}`, { method: 'POST' });
    if (res.ok) { playUndoFeedback(); setDone(false); setUndoTaskId(null); }
    else setRemoving(true);
  }

  if (removing) return null;

  const cls = taskItemClass(task);
  const text = cleanTaskText(task.task);
  const filteredTags = source === 'next'
    ? { ...task, tags: extractTags(task.task).filter(t => t !== '#next') }
    : task;

  return (
    <div className={`task-item${cls}${done ? ' task-done' : ''}`}>
      {done ? (
        <button className="undo-btn" onClick={undo}>Undo</button>
      ) : task.completable ? (
        <input type="checkbox" className="task-checkbox" onChange={complete} />
      ) : (
        <span className="task-checkbox-placeholder" title="Unsupported recurrence" />
      )}
      <div className="task-body" style={{ cursor: 'pointer' }} onClick={onEdit}>
        <div className="task-text" dangerouslySetInnerHTML={{ __html: renderLinksHtml(text) }} />
        <div className="task-meta">
          <TaskBadges task={filteredTags} />
        </div>
      </div>
    </div>
  );
}

export function Planning({ onEditTask, onNextAction }: Props) {
  const { data: nextData, isLoading: nextLoading, isError: nextError } = useQuery<{ tasks: Record<string, Task> }>({
    queryKey: ['next-tasks'],
    queryFn: () => fetch('/next-tasks').then(r => r.json()),
    refetchOnWindowFocus: false,
  });

  const { data: upcomingData, isLoading: upLoading, isError: upError } = useQuery<{ tasks: Record<string, Task> }>({
    queryKey: ['upcoming-tasks'],
    queryFn: () => fetch('/upcoming-tasks').then(r => r.json()),
    refetchOnWindowFocus: false,
  });

  const nextTasks = nextData?.tasks ?? {};
  const upcomingTasks = upcomingData?.tasks ?? {};

  const sortIds = (ids: string[], store: Record<string, Task>) => {
    const primaryDate = (t: Task) => {
      const dates = ([t.due, t.scheduled].filter(Boolean) as string[]).sort();
      return dates[0] ?? '9999-99-99';
    };
    return [...ids].sort((a, b) => {
      const ta = store[a], tb = store[b];
      const byDate = primaryDate(ta).localeCompare(primaryDate(tb));
      if (byDate !== 0) return byDate;
      const byStart = (ta.start ?? '9999-99-99').localeCompare(tb.start ?? '9999-99-99');
      if (byStart !== 0) return byStart;
      return ta.task.localeCompare(tb.task);
    });
  };

  const nextIds = sortIds(Object.keys(nextTasks), nextTasks);
  const upcomingIds = sortIds(Object.keys(upcomingTasks), upcomingTasks);

  return (
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="tasks-row planning-row">
        <div className="card">
          <div className="tasks-header"><h2>Next</h2></div>
          {nextLoading && <div className="empty-state"><span className="spinner" /> Loading…</div>}
          {nextError  && <div className="empty-state" style={{ color: 'var(--danger)' }}>Failed to load.</div>}
          {!nextLoading && !nextError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {nextIds.length === 0
                ? <div className="empty-state">No #next tasks.</div>
                : nextIds.map(id => (
                  <PlanningTaskRow
                    key={id} id={id} task={nextTasks[id]} source="next"
                    onEdit={() => onEditTask(nextTasks[id], 'next')}
                    onNextAction={onNextAction}
                  />
                ))
              }
            </div>
          )}
        </div>

        <div className="card">
          <div className="tasks-header">
            <h2>Upcoming <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>(next 30 days)</span></h2>
          </div>
          {upLoading && <div className="empty-state"><span className="spinner" /> Loading…</div>}
          {upError   && <div className="empty-state" style={{ color: 'var(--danger)' }}>Failed to load.</div>}
          {!upLoading && !upError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingIds.length === 0
                ? <div className="empty-state">No upcoming tasks.</div>
                : upcomingIds.map(id => (
                  <PlanningTaskRow
                    key={id} id={id} task={upcomingTasks[id]} source="upcoming"
                    onEdit={() => onEditTask(upcomingTasks[id], 'upcoming')}
                    onNextAction={onNextAction}
                  />
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
