import { useState, lazy, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/Header/Header';
import { Task, TabName, TaskEditState, NextActionState, ItemSource, UnifiedItem } from '@/types';
import { TaskModal } from '@/components/TaskModal/TaskModal';
import { NextActionModal } from '@/components/NextActionModal/NextActionModal';
import { cleanTaskText } from '@/utils/taskUtils';

function taskToUnified(task: Task): UnifiedItem {
  return {
    id: task.raw_line,
    raw_line: task.raw_line,
    rel_path: task.rel_path,
    description: cleanTaskText(task.task),
    due: task.due,
    scheduled: task.scheduled,
    start: task.start,
    time: task.time,
    recur: task.recur,
    tags: task.tags ?? [],
  };
}

const Today    = lazy(() => import('./tabs/Today/Today').then(m => ({ default: m.Today })));
const Planning = lazy(() => import('./tabs/Planning/Planning').then(m => ({ default: m.Planning })));
const Inbox    = lazy(() => import('./tabs/Inbox/Inbox').then(m => ({ default: m.Inbox })));
const Habits   = lazy(() => import('./tabs/Habits/Habits').then(m => ({ default: m.Habits })));
const Music    = lazy(() => import('./tabs/Music/Music').then(m => ({ default: m.Music })));
const Workout  = lazy(() => import('./tabs/Workout/Workout').then(m => ({ default: m.Workout })));
const Food     = lazy(() => import('./tabs/Food/Food').then(m => ({ default: m.Food })));
const Finance  = lazy(() => import('./tabs/Finance/Finance').then(m => ({ default: m.Finance })));

const TABS: { id: TabName; icon: string; alt: string }[] = [
  { id: 'today',    icon: '/assets/today.svg',    alt: 'Today' },
  { id: 'planning', icon: '/assets/planning.svg', alt: 'Planning' },
  { id: 'inbox',    icon: '/assets/inbox.svg',    alt: 'Inbox' },
  { id: 'habits',   icon: '/assets/habits.svg',   alt: 'Habits' },
  { id: 'finance',  icon: '/assets/finance.svg',  alt: 'Finance' },
  { id: 'workout',  icon: '/assets/workout.svg',  alt: 'Workout' },
  { id: 'music',    icon: '/assets/music.svg',    alt: 'Music' },
  { id: 'food',     icon: '/assets/food.svg',     alt: 'Food' },
];

function TabFallback() {
  return <div className="empty-state"><span className="spinner" /> Loading…</div>;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabName>(() => {
    return (localStorage.getItem('activeTab') as TabName) ?? 'today';
  });
  const qc = useQueryClient();

  const { data: todayData } = useQuery<{ tasks: Record<string, unknown> }>({
    queryKey: ['today-tasks'],
    queryFn: () => fetch('/today-tasks').then(r => r.json()),
    refetchOnWindowFocus: false,
  });
  const { data: inboxData } = useQuery<{ items: unknown[] }>({
    queryKey: ['inbox-items'],
    queryFn: () => fetch('/inbox-items').then(r => r.json()),
    refetchOnWindowFocus: false,
  });

  const todayBadge = Object.keys(todayData?.tasks ?? {}).length;
  const inboxBadge = inboxData?.items.length ?? 0;
  const [taskEdit,     setTaskEdit]     = useState<TaskEditState | null>(null);
  const [nextAction, setNextAction] = useState<NextActionState | null>(null);

  // Track which tabs have been visited (for lazy loading)
  const [visited, setVisited] = useState<Set<TabName>>(() => new Set([activeTab]));

  function switchTab(tab: TabName) {
    setActiveTab(tab);
    setVisited(prev => new Set([...prev, tab]));
    localStorage.setItem('activeTab', tab);
    if (tab === 'today') qc.invalidateQueries({ queryKey: ['today-tasks'] });
    if (tab === 'inbox') qc.invalidateQueries({ queryKey: ['inbox-items'] });
  }

  function openTaskEdit(task: Task, source: ItemSource) {
    setTaskEdit({ item: taskToUnified(task), source });
  }

  return (
    <>
      <Header />
      <div className="main">
        <div className="tabs">
          {TABS.map(({ id, icon, alt }) => (
            <button
              key={id}
              className={`tab-btn${activeTab === id ? ' active' : ''}`}
              onClick={() => switchTab(id)}
              style={{ position: 'relative' }}
            >
              <img src={icon} alt={alt} />
              {id === 'today' && todayBadge > 0 && (
                <span className="inbox-tab-badge">{todayBadge}</span>
              )}
              {id === 'inbox' && inboxBadge > 0 && (
                <span className="inbox-tab-badge">{inboxBadge}</span>
              )}
            </button>
          ))}
        </div>

          {/* Today is always mounted; others mount on first visit and stay mounted */}
          <Suspense fallback={<TabFallback />}>
            <div style={{ display: activeTab === 'today' ? 'contents' : 'none' }}>
              <Today onEditTask={task => openTaskEdit(task, 'today')} />
            </div>
          </Suspense>

          {visited.has('planning') && (
            <Suspense fallback={<TabFallback />}>
              <div style={{ display: activeTab === 'planning' ? 'contents' : 'none' }}>
                <Planning
                  onEditTask={(task, source) => openTaskEdit(task, source)}
                  onNextAction={(relPath, file) => setNextAction({ relPath, file })}
                />
              </div>
            </Suspense>
          )}

          {visited.has('inbox') && (
            <Suspense fallback={<TabFallback />}>
              <div style={{ display: activeTab === 'inbox' ? 'contents' : 'none' }}>
                <Inbox />
              </div>
            </Suspense>
          )}

          {visited.has('habits') && (
            <Suspense fallback={<TabFallback />}>
              <div style={{ display: activeTab === 'habits' ? 'contents' : 'none' }}>
                <Habits />
              </div>
            </Suspense>
          )}

          {visited.has('finance') && (
            <Suspense fallback={<TabFallback />}>
              <div style={{ display: activeTab === 'finance' ? 'contents' : 'none' }}>
                <Finance />
              </div>
            </Suspense>
          )}

          {visited.has('workout') && (
            <Suspense fallback={<TabFallback />}>
              <div style={{ display: activeTab === 'workout' ? 'contents' : 'none' }}>
                <Workout />
              </div>
            </Suspense>
          )}

          {visited.has('music') && (
            <Suspense fallback={<TabFallback />}>
              <div style={{ display: activeTab === 'music' ? 'contents' : 'none' }}>
                <Music />
              </div>
            </Suspense>
          )}

          {visited.has('food') && (
            <Suspense fallback={<TabFallback />}>
              <div style={{ display: activeTab === 'food' ? 'contents' : 'none' }}>
                <Food />
              </div>
            </Suspense>
          )}
      </div>

      {taskEdit && (
        <TaskModal
          item={taskEdit.item}
          source={taskEdit.source}
          onClose={() => setTaskEdit(null)}
        />
      )}

      {nextAction && (
        <NextActionModal
          relPath={nextAction.relPath}
          file={nextAction.file}
          onClose={() => setNextAction(null)}
        />
      )}
    </>
  );
}
