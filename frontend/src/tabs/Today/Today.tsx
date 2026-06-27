import { useState, useEffect, FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Task } from '@/types';
import { TaskBadges, taskItemClass } from '@/components/TaskBadges/TaskBadges';
import { cleanTaskText } from '@/utils/taskUtils';
import { renderLinksHtml } from '@/utils/textUtils';
import { todayIso } from '@/utils/dateUtils';
import { playCompletionFeedback, playUndoFeedback } from '@/utils/audioUtils';

interface Props {
  onEditTask: (task: Task) => void;
  tabBadgeRef?: (count: number) => void;
}

interface TodayTasksResponse {
  tasks: Record<string, Task>;
}

function sortTaskIds(ids: string[], tasks: Record<string, Task>): string[] {
  const today = todayIso();
  const isOverdue = (t: Task) => !!(t.due && t.due < today) || !!(t.scheduled && t.scheduled < today);
  const isStarted = (t: Task) => !isOverdue(t) && !!(t.start && t.start <= today);
  const rank = (t: Task) => isOverdue(t) ? 0 : isStarted(t) ? 2 : 1;
  const primaryDate = (t: Task) => {
    const dates = ([t.due, t.scheduled].filter(Boolean) as string[]).sort();
    return dates[0] ?? '9999-99-99';
  };

  return [...ids].sort((a, b) => {
    const ta = tasks[a], tb = tasks[b];
    const ra = rank(ta), rb = rank(tb);
    if (ra !== rb) return ra - rb;
    const byDate = primaryDate(ta).localeCompare(primaryDate(tb));
    if (byDate !== 0) return byDate;
    const byStart = (ta.start ?? '9999-99-99').localeCompare(tb.start ?? '9999-99-99');
    if (byStart !== 0) return byStart;
    return ta.task.localeCompare(tb.task);
  });
}

interface TaskRowProps {
  id: string;
  task: Task;
  onEdit: () => void;
}

function TaskRow({ id, task, onEdit }: TaskRowProps) {
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [removing, setRemoving] = useState(false);

  async function complete() {
    const res = await fetch(`/complete-task/${id}`, { method: 'POST' });
    if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Failed'); return; }
    playCompletionFeedback();
    setDone(true);
    const t = setTimeout(() => setRemoving(true), 5000);
    setUndoTimer(t);
  }

  async function undo() {
    if (undoTimer) clearTimeout(undoTimer);
    setUndoTimer(null);
    const res = await fetch(`/undo-complete-task/${id}`, { method: 'POST' });
    if (res.ok) { playUndoFeedback(); setDone(false); }
    else setRemoving(true);
  }

  if (removing) return null;

  const cls = taskItemClass(task);
  const text = cleanTaskText(task.task);

  return (
    <div
      className={`task-item${cls}${done ? ' task-done' : ''}`}
      style={removing ? { opacity: 0, transition: 'opacity 0.3s' } : undefined}
    >
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
          <TaskBadges task={task} />
        </div>
      </div>
    </div>
  );
}

export function Today({ onEditTask, tabBadgeRef }: Props) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery<TodayTasksResponse>({
    queryKey: ['today-tasks'],
    queryFn: () => fetch('/today-tasks').then(r => r.json()),
    refetchOnWindowFocus: false,
  });

  const [todayTask, setTodayTask] = useState('');
  const [todayTime, setTodayTime] = useState('');
  const [todayFeedback, setTodayFeedback] = useState('');
  const [todayFeedbackOk, setTodayFeedbackOk] = useState(false);


  async function submitToday(e: FormEvent) {
    e.preventDefault();
    setTodayFeedback('');
    let url = `/add-today-task?task=${encodeURIComponent(todayTask)}`;
    if (todayTime) url += `&time=${encodeURIComponent(todayTime)}`;
    const res = await fetch(url);
    const d = await res.json();
    if (res.ok) {
      setTodayFeedbackOk(true);
      setTodayFeedback('Added to today.');
      setTodayTask('');
      setTodayTime('');
      qc.invalidateQueries({ queryKey: ['today-tasks'] });
    } else {
      setTodayFeedbackOk(false);
      setTodayFeedback(d.error ?? 'Error.');
    }
  }

  const tasks = data?.tasks ?? {};
  const sortedIds = sortTaskIds(Object.keys(tasks), tasks);
  const count = sortedIds.length;

  useEffect(() => { tabBadgeRef?.(count); }, [count]);

  return (
    <div className="tab-panel active" id="tab-today" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="tasks-row">
        <div className="card">
          <div className="tasks-header">
            <h2>Today {count > 0 && <span className="inbox-count-badge">{count}</span>}</h2>
          </div>
          {isLoading && <div className="empty-state"><span className="spinner" /> Loading…</div>}
          {isError && <div className="empty-state" style={{ color: 'var(--danger)' }}>Failed to load tasks.</div>}
          {!isLoading && !isError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedIds.length === 0
                ? <div className="empty-state">No tasks for today.</div>
                : sortedIds.map(id => (
                  <TaskRow
                    key={id}
                    id={id}
                    task={tasks[id]}
                    onEdit={() => onEditTask(tasks[id])}
                  />
                ))
              }
            </div>
          )}
        </div>
      </div>

      <div className="tasks-row">
        <div className="card">
          <h2>Add to Today</h2>
          <form onSubmit={submitToday}>
            <div className="form-row">
              <input type="text" value={todayTask} onChange={e => setTodayTask(e.target.value)} placeholder="Task description…" required />
              <input type="time" value={todayTime} onChange={e => setTodayTime(e.target.value)} />
              <button type="submit" title="Add">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            </div>
            <div className={`feedback${todayFeedbackOk ? ' ok' : todayFeedback ? ' err' : ''}`}>{todayFeedback}</div>
          </form>
        </div>
      </div>
    </div>
  );
}
