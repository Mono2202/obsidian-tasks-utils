import { Task } from '@/types';
import { fmtDate, todayIso } from '@/utils/dateUtils';
import { extractTags, tagBadgeClass, folderBadgeStyle } from '@/utils/taskUtils';
import { obsidianFileHref } from '@/utils/textUtils';

interface Props {
  task: Pick<Task, 'due' | 'scheduled' | 'start' | 'time' | 'recur' | 'rel_path' | 'file' | 'top_folder' | 'task'> & { tags?: string[] };
}

export function TaskBadges({ task }: Props) {
  const today = todayIso();
  const overdue = !!(task.due && task.due < today) || !!(task.scheduled && task.scheduled < today);
  const overdueDate = task.due && task.due < today ? task.due : task.scheduled;
  const tags = task.tags ?? extractTags(task.task ?? '');

  return (
    <>
      {overdue && (
        <span className="badge overdue">!!! {fmtDate(overdueDate)}</span>
      )}
      {task.start && (
        <span className="badge started">🛫 {fmtDate(task.start)}</span>
      )}
      {!overdue && task.due && (
        <span className="badge due">📅 {fmtDate(task.due)}</span>
      )}
      {!overdue && task.scheduled && (
        <span className="badge scheduled">⏳ {fmtDate(task.scheduled)}</span>
      )}
      {task.time && (
        <span className="badge time">@ {task.time}</span>
      )}
      {task.recur && (
        <span className="badge recur">🔁 {task.recur}</span>
      )}
      {tags.filter(t => t !== '#next').map(tag => (
        <span key={tag} className={`badge ${tagBadgeClass(tag)}`}>{tag}</span>
      ))}
      {task.rel_path ? (
        <a
          className="badge file clickable"
          style={task.top_folder ? { ...(folderBadgeStyleObj(task.top_folder)) } : undefined}
          href={obsidianFileHref(task.rel_path)}
          onClick={e => { e.stopPropagation(); }}
        >
          {task.file}
        </a>
      ) : task.file ? (
        <span className="badge file" style={task.top_folder ? { ...(folderBadgeStyleObj(task.top_folder)) } : undefined}>
          {task.file}
        </span>
      ) : null}
    </>
  );
}

function folderBadgeStyleObj(folder: string): React.CSSProperties {
  const style = folderBadgeStyle(folder);
  if (!style) return {};
  const result: Record<string, string> = {};
  style.split(';').forEach(part => {
    const [key, value] = part.split(':').map(s => s.trim());
    if (key && value) {
      const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      result[camel] = value;
    }
  });
  return result as React.CSSProperties;
}

export function taskItemClass(task: Pick<Task, 'due' | 'scheduled' | 'start'>): string {
  const today = todayIso();
  const overdue = !!(task.due && task.due < today) || !!(task.scheduled && task.scheduled < today);
  if (overdue) return ' overdue';
  if (task.scheduled === today || task.due === today) return ' scheduled-today';
  if (task.start && task.start <= today) return ' started';
  return '';
}
