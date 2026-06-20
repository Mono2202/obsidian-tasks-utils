import { useState, useEffect, useRef, FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Exercise, ExerciseSuggestion, WorkoutRecord, WorkoutSession, WorkoutProgress } from '@/types';
import { playCompletionFeedback } from '@/utils/audioUtils';

// ── Rest timer ────────────────────────────────────────────────────────────────

const REST_END_KEY = 'restTimerEndTime';
const REST_DUR_KEY = 'restTimerFullDuration';

function useRestTimer() {
  const [duration, setDuration] = useState(() => parseInt(localStorage.getItem('restTimerDuration') ?? '90'));
  const [remaining, setRemaining] = useState(0);
  const [fullDuration, setFullDuration] = useState(duration);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimer() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  function startFromEndTime(endTime: number, fullDur: number) {
    clearTimer();
    setFullDuration(fullDur);
    setRunning(true);
    setDone(false);
    const tick = () => {
      const rem = Math.round((endTime - Date.now()) / 1000);
      if (rem <= 0) {
        clearTimer();
        localStorage.removeItem(REST_END_KEY);
        setRemaining(0);
        setRunning(false);
        setDone(true);
        playCompletionFeedback();
        fetch('/workout/rest-done', { method: 'POST' }).catch(() => {});
        setTimeout(() => setDone(false), 3000);
        return;
      }
      setRemaining(rem);
    };
    tick();
    intervalRef.current = setInterval(tick, 500);
  }

  function start(dur = duration) {
    const endTime = Date.now() + dur * 1000;
    localStorage.setItem(REST_END_KEY, String(endTime));
    localStorage.setItem(REST_DUR_KEY, String(dur));
    fetch('/workout/rest-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ end_time: endTime / 1000 }),
    }).catch(() => {});
    startFromEndTime(endTime, dur);
  }

  function stop() {
    clearTimer();
    localStorage.removeItem(REST_END_KEY);
    setRunning(false);
    setDone(false);
    fetch('/workout/rest-cancel', { method: 'POST' }).catch(() => {});
  }

  function adjust(delta: number) {
    const next = Math.max(15, Math.min(600, duration + delta));
    setDuration(next);
    localStorage.setItem('restTimerDuration', String(next));
    if (running) start(next);
  }

  // Resume from localStorage on mount
  useEffect(() => {
    const endTime = parseInt(localStorage.getItem(REST_END_KEY) ?? '0');
    if (!endTime) return;
    const rem = Math.round((endTime - Date.now()) / 1000);
    if (rem <= 0) { localStorage.removeItem(REST_END_KEY); return; }
    const fullDur = parseInt(localStorage.getItem(REST_DUR_KEY) ?? String(duration));
    startFromEndTime(endTime, fullDur);
    return clearTimer;
  }, []);

  return { running, done, remaining, fullDuration, duration, start, stop, adjust };
}

// ── Progress chart ────────────────────────────────────────────────────────────

function ProgressChart({ progress }: { progress: WorkoutProgress[] }) {
  if (!progress.length) return <div className="empty-state" style={{ padding: 8 }}>No data.</div>;

  const W = 400, H = 160;
  const PAD = { top: 10, right: 12, bottom: 32, left: 42 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const n = progress.length;
  const weights = progress.map(p => p.weight_num);
  const minW = Math.min(...weights), maxW = Math.max(...weights);
  const wRange = maxW - minW || 1;

  const xScale = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const yScale = (w: number) => PAD.top + plotH - ((w - minW) / wRange) * plotH;

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const w = minW + wRange * i / 4;
    const y = yScale(w);
    return { w, y };
  });

  let prevDate: string | null = null;
  const dateSeps: Array<{ x: number; label: string; isFirst: boolean }> = [];
  progress.forEach((p, i) => {
    if (p.date !== prevDate) {
      const [, m_, d_] = p.date.split('-');
      dateSeps.push({ x: xScale(i), label: `${d_}.${m_}`, isFirst: prevDate !== null });
      prevDate = p.date;
    }
  });

  const pts = progress.map((p, i) => `${xScale(i).toFixed(1)},${yScale(p.weight_num).toFixed(1)}`).join(' ');

  return (
    <div className="workout-progress-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', overflow: 'visible' }}>
        {gridLines.map(({ w, y }) => (
          <g key={w}>
            <line x1={PAD.left} y1={y.toFixed(1)} x2={PAD.left + plotW} y2={y.toFixed(1)} stroke="var(--border)" strokeWidth="0.5" />
            <text x={PAD.left - 5} y={(y + 4).toFixed(1)} textAnchor="end" fontSize={9} fill="var(--text-muted)" fontFamily="inherit">{w.toFixed(0)}</text>
          </g>
        ))}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke="var(--border)" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke="var(--border)" strokeWidth="1" />
        {dateSeps.map(({ x, label, isFirst }, i) => (
          <g key={i}>
            {isFirst && <line x1={x.toFixed(1)} y1={PAD.top} x2={x.toFixed(1)} y2={PAD.top + plotH} stroke="var(--border)" strokeWidth="0.8" strokeDasharray="3,3" />}
            <text x={x.toFixed(1)} y={PAD.top + plotH + 14} textAnchor="middle" fontSize={9} fill="var(--text-muted)" fontFamily="inherit">{label}</text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke="#a98ef5" strokeWidth="1.5" opacity="0.5" />
        {progress.map((p, i) => {
          const [yr_, m_, d_] = p.date.split('-');
          return (
            <circle key={i} cx={xScale(i).toFixed(1)} cy={yScale(p.weight_num).toFixed(1)} r={4} fill="#a98ef5" opacity="0.9">
              <title>{`${d_}.${m_}.${yr_}  ${p.weight} × ${p.reps}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

// ── Exercise list helpers ─────────────────────────────────────────────────────

interface ExGroup { name: string; sets: Array<Exercise & { flatIndex: number }> }

function groupExercises(exercises: Exercise[]): ExGroup[] {
  const groups: ExGroup[] = [];
  exercises.forEach((ex, flatIndex) => {
    const last = groups[groups.length - 1];
    if (last && last.name === ex.name) last.sets.push({ ...ex, flatIndex });
    else groups.push({ name: ex.name, sets: [{ ...ex, flatIndex }] });
  });
  return groups;
}

interface MergedSet { key: string; items: Array<Exercise & { flatIndex: number }> }

function mergeIdenticalSets(sets: Array<Exercise & { flatIndex: number }>): MergedSet[] {
  const merged: MergedSet[] = [];
  sets.forEach(s => {
    const key = `${s.sets}|${s.reps}|${s.weight ?? ''}`;
    const last = merged[merged.length - 1];
    if (last && last.key === key) last.items.push(s);
    else merged.push({ key, items: [s] });
  });
  return merged;
}

function ExStats({ sets, reps, weight }: { sets: number; reps: number; weight: string | null }) {
  return (
    <>
      <span className="ex-sets">{sets}</span>
      <span className="ex-x">×</span>
      <span className="ex-reps">{reps}</span>
      {weight && <><span className="ex-x"> @ </span><span className="ex-weight">{weight}</span></>}
    </>
  );
}

function WorkoutList({ exercises, onDelete }: { exercises: Exercise[]; onDelete: (i: number) => void }) {
  if (!exercises.length) return <div className="empty-state">No exercises logged yet.</div>;
  return (
    <>
      {groupExercises(exercises).map((group, gi) => (
        <div key={`${group.name}-${gi}`} className="workout-item">
          <span className="workout-item-name">{group.name}</span>
          <div className="workout-set-rows">
            {mergeIdenticalSets(group.sets).map((sg, si) => {
              const totalSets = sg.items.reduce((acc, s) => acc + s.sets, 0);
              const lastIndex = sg.items[sg.items.length - 1].flatIndex;
              return (
                <div key={`${sg.key}-${si}`} className="workout-set-row">
                  <span className="workout-set-stats"><ExStats sets={totalSets} reps={sg.items[0].reps} weight={sg.items[0].weight} /></span>
                  <button className="workout-delete-btn" onClick={() => onDelete(lastIndex)} title="Remove">×</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function WorkoutHistory({ history, onFill }: {
  history: WorkoutSession[];
  onFill: (name: string, sets: number, reps: number, weight: string) => void;
}) {
  if (!history.length) return <div className="empty-state">No recent workouts.</div>;
  return (
    <>
      {history.map(session => {
        const date = new Date(session.date + 'T00:00:00');
        const label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        return (
          <div key={session.date} className="workout-history-session">
            <div className="workout-history-date">{label}</div>
            <div className="workout-history-exercises">
              {groupExercises(session.exercises).map((group, gi) => (
                <div key={`${group.name}-${gi}`} className="workout-history-ex">
                  <span className="workout-history-ex-name">{group.name}</span>
                  <div className="workout-set-rows">
                    {mergeIdenticalSets(group.sets).map((sg, si) => {
                      const totalSets = sg.items.reduce((acc, s) => acc + s.sets, 0);
                      const s = sg.items[0];
                      return (
                        <div key={`${sg.key}-${si}`} className="workout-set-row workout-history-row-clickable" onClick={() => onFill(group.name, s.sets, s.reps, s.weight ?? '')}>
                          <span className="workout-set-stats"><ExStats sets={totalSets} reps={s.reps} weight={s.weight} /></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function RecordRow({ record, suggestions, onFill }: {
  record: WorkoutRecord;
  suggestions: ExerciseSuggestion[];
  onFill: (name: string, weight: string, sets: number, reps: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<WorkoutProgress[] | null>(null);

  async function toggle() {
    if (!open && !progress) {
      const res = await fetch(`/workout/progress?exercise=${encodeURIComponent(record.name)}`);
      const d = await res.json();
      setProgress(d.progress ?? []);
    }
    setOpen(p => !p);
  }

  const d = new Date(record.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  function useSuggestion() {
    const sug = suggestions.find(s => s.name === record.name);
    onFill(record.name, record.weight, sug?.sets ?? 3, sug?.reps ?? 8);
  }

  return (
    <>
      <div className="workout-record-row" onClick={toggle}>
        <span className="workout-record-name">{record.name}</span>
        <span className="workout-record-weight">{record.weight} <span className="ex-x">×</span><span className="ex-reps">{record.reps}</span></span>
        <span className="workout-record-date">{dateStr}</span>
        <button
          className="workout-record-use-btn"
          title="Fill form"
          onClick={e => { e.stopPropagation(); useSuggestion(); }}
        >↑</button>
      </div>
      {open && (
        <div className="workout-progress-wrap">
          {progress === null
            ? <div className="empty-state" style={{ padding: 8 }}><span className="spinner" /></div>
            : <ProgressChart progress={progress} />
          }
        </div>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function Workout() {
  const qc = useQueryClient();
  const restTimer = useRestTimer();

  const { data: todayData, isLoading: todayLoading } = useQuery<{ exercises: Exercise[] }>({
    queryKey: ['workout-today'],
    queryFn: () => fetch('/workout/today').then(r => r.json()),
    refetchOnWindowFocus: false,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{ history: WorkoutSession[] }>({
    queryKey: ['workout-history'],
    queryFn: () => fetch('/workout/history').then(r => r.json()),
    refetchOnWindowFocus: false,
  });

  const { data: recordsData, isLoading: recordsLoading } = useQuery<{ records: WorkoutRecord[] }>({
    queryKey: ['workout-records'],
    queryFn: () => fetch('/workout/records').then(r => r.json()),
    refetchOnWindowFocus: false,
  });

  const { data: suggestionsData } = useQuery<{ exercises: ExerciseSuggestion[] }>({
    queryKey: ['workout-exercises'],
    queryFn: () => fetch('/workout/exercises').then(r => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  const exercises = todayData?.exercises ?? [];
  const history = historyData?.history ?? [];
  const records = recordsData?.records ?? [];
  const suggestions = suggestionsData?.exercises ?? [];

  const recordsMap: Record<string, WorkoutRecord> = {};
  records.forEach(r => { recordsMap[r.name] = r; });

  // Form state
  const [name, setName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = name
    ? suggestions.filter(s => s.name.toLowerCase().includes(name.toLowerCase()))
    : [];

  function fillForm(n: string, s: number, r: number, w: string) {
    setName(n); setSets(String(s)); setReps(String(r)); setWeight(w);
    setShowSuggestions(false);
    nameRef.current?.focus();
  }

  function clearForm() {
    setName(''); setSets(''); setReps(''); setWeight(''); setFeedback('');
    setShowSuggestions(false);
    nameRef.current?.focus();
  }

  function parseWeightNum(w: string | null): number | null {
    if (!w) return null;
    const m = w.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  }

  async function onAddExercise(e: FormEvent) {
    e.preventDefault();
    const res = await fetch('/workout/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sets: parseInt(sets), reps: parseInt(reps), weight: weight || null }),
    });
    const d = await res.json();
    if (res.ok) {
      const newWeightNum = parseWeightNum(weight);
      const existing = recordsMap[name];
      const isNewPR = newWeightNum !== null && (!existing || newWeightNum > existing.weight_num || (newWeightNum === existing.weight_num && parseInt(reps) > existing.reps));
      playCompletionFeedback();
      qc.setQueryData<{ exercises: Exercise[] }>(['workout-today'], { exercises: d.exercises });
      setFeedback(isNewPR ? '🏆 New personal record!' : '');
      qc.invalidateQueries({ queryKey: ['workout-exercises'] });
      if (isNewPR) qc.invalidateQueries({ queryKey: ['workout-records'] });
      restTimer.start();
      nameRef.current?.focus();
    } else {
      setFeedback(d.error ?? 'Failed to add.');
    }
  }

  async function onDelete(index: number) {
    const res = await fetch('/workout/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    });
    if (res.ok) {
      const d = await res.json();
      qc.setQueryData<{ exercises: Exercise[] }>(['workout-today'], { exercises: d.exercises });
    }
  }

  const m = Math.floor(restTimer.remaining / 60), s = restTimer.remaining % 60;
  const restDisplay = restTimer.done ? 'Go! 💪' : `${m}:${String(s).padStart(2, '0')}`;
  const durM = Math.floor(restTimer.duration / 60), durS = restTimer.duration % 60;
  const durLabel = durM > 0 ? `${durM}:${String(durS).padStart(2, '0')}` : `${durS}s`;
  const barPct = restTimer.running ? Math.max(0, (restTimer.remaining / restTimer.fullDuration) * 100) : 0;

  return (
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="tasks-row workout-tasks-row">
        <div className="card" style={{ flex: 2, minWidth: 0 }}>
          <div className="tasks-header"><h2>Today's Workout</h2></div>
          {todayLoading
            ? <div className="empty-state"><span className="spinner" /> Loading…</div>
            : <WorkoutList exercises={exercises} onDelete={onDelete} />
          }

          <form onSubmit={onAddExercise} style={{ marginTop: 16 }}>
            <div className="workout-form-grid">
              <div className="workout-name-wrap">
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Exercise name"
                  required
                  autoComplete="off"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="workout-suggestions">
                    {filteredSuggestions.map((s, i) => (
                      <div key={i} className="workout-suggestion-item" onMouseDown={() => fillForm(s.name, s.sets, s.reps, s.weight ?? '')}>
                        {s.name}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>
                          {s.sets}×{s.reps}{s.weight ? ` @ ${s.weight}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input id="workout-sets" type="number" value={sets} onChange={e => setSets(e.target.value)} placeholder="Sets" min={1} required />
              <input id="workout-reps" type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="Reps" min={1} required />
              <input id="workout-weight" type="text" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Weight" autoComplete="off" required />
              <div className="workout-btn-group">
                <button type="submit" className="workout-add-btn" title="Add">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
                <button type="button" className="workout-clear-btn" onClick={clearForm}>Clear</button>
              </div>
            </div>
            <div className="feedback">{feedback}</div>
          </form>

          {(restTimer.running || restTimer.done) && (
            <div id="rest-timer-section" className={restTimer.done ? 'rest-timer-done' : ''}>
              <div className="rest-timer-bar-track">
                <div className="rest-timer-bar" style={{ width: `${barPct}%` }} />
              </div>
              <div className="rest-timer-row">
                <span className="rest-timer-display">{restDisplay}</span>
                <div className="rest-timer-btns">
                  <button className="rest-timer-btn" onClick={() => restTimer.start()} title="Reset">↺</button>
                  <button className="rest-timer-btn rest-timer-skip" onClick={restTimer.stop} title="Skip">✕</button>
                </div>
              </div>
              <div className="rest-timer-duration-row">
                <button className="rest-timer-adj" onClick={() => restTimer.adjust(-15)}>−</button>
                <span>{durLabel}</span>
                <button className="rest-timer-adj" onClick={() => restTimer.adjust(15)}>+</button>
              </div>
            </div>
          )}
        </div>

        <div className="workout-side-col">
          <div className="card">
            <h2>Records</h2>
            {recordsLoading
              ? <div className="empty-state"><span className="spinner" /> Loading…</div>
              : records.length === 0
                ? <div className="empty-state">No records yet.</div>
                : records.map(r => (
                  <RecordRow
                    key={r.name}
                    record={r}
                    suggestions={suggestions}
                    onFill={(n, w, s, rep) => fillForm(n, s, rep, w)}
                  />
                ))
            }
          </div>
          <div className="card">
            <h2>History</h2>
            {historyLoading
              ? <div className="empty-state"><span className="spinner" /> Loading…</div>
              : <WorkoutHistory history={history} onFill={(n, s, r, w) => fillForm(n, s, r, w)} />
            }
          </div>
        </div>
      </div>
    </div>
  );
}
