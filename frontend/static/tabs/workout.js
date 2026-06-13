let _exerciseSuggestions = [];
let _filteredSuggestions = [];
let _workoutRecords = {};

let _restDuration = parseInt(localStorage.getItem('restTimerDuration') || '90');
let _restFullDuration = _restDuration;
let _restRemaining = 0;
let _restInterval = null;

const _REST_END_KEY  = 'restTimerEndTime';
const _REST_DUR_KEY  = 'restTimerFullDuration';

function _adjustRestDuration(delta) {
  _restDuration = Math.max(15, Math.min(600, _restDuration + delta));
  localStorage.setItem('restTimerDuration', _restDuration);
  _updateRestDurLabel();
  if (_restInterval) { stopRestTimer(); startRestTimer(); }
}

function _updateRestDurLabel() {
  const m = Math.floor(_restDuration / 60), s = _restDuration % 60;
  document.getElementById('rest-timer-dur-label').textContent =
    m > 0 ? `${m}:${String(s).padStart(2,'0')}` : `${s}s`;
}

function _updateRestDisplay() {
  const m = Math.floor(_restRemaining / 60), s = _restRemaining % 60;
  document.getElementById('rest-timer-display').textContent =
    `${m}:${String(s).padStart(2,'0')}`;
  document.getElementById('rest-timer-bar').style.width =
    `${Math.max(0, (_restRemaining / _restFullDuration) * 100)}%`;
}

function _startTimerFromEndTime(endTime) {
  if (_restInterval) { clearInterval(_restInterval); _restInterval = null; }
  _updateRestDurLabel();
  document.getElementById('rest-timer-section').style.display = 'block';

  const tick = () => {
    _restRemaining = Math.round((endTime - Date.now()) / 1000);
    if (_restRemaining <= 0) {
      clearInterval(_restInterval);
      _restInterval = null;
      localStorage.removeItem(_REST_END_KEY);
      _restTimerDone();
      return;
    }
    _updateRestDisplay();
  };
  tick();
  _restInterval = setInterval(tick, 500);
}

function startRestTimer() {
  stopRestTimer();
  _restFullDuration = _restDuration;
  const endTime = Date.now() + _restDuration * 1000;
  localStorage.setItem(_REST_END_KEY, endTime);
  localStorage.setItem(_REST_DUR_KEY, _restDuration);
  _startTimerFromEndTime(endTime);
}

function _resumeRestTimer() {
  const endTime = parseInt(localStorage.getItem(_REST_END_KEY) || '0');
  if (!endTime) return;
  const remaining = Math.round((endTime - Date.now()) / 1000);
  if (remaining <= 0) { localStorage.removeItem(_REST_END_KEY); return; }
  _restFullDuration = parseInt(localStorage.getItem(_REST_DUR_KEY) || _restDuration);
  _startTimerFromEndTime(endTime);
}

function resetRestTimer() { startRestTimer(); }

function _restTimerDone() {
  playCompletionFeedback();
  const section = document.getElementById('rest-timer-section');
  section.classList.add('rest-timer-done');
  document.getElementById('rest-timer-display').textContent = 'Go! 💪';
  document.getElementById('rest-timer-bar').style.width = '0%';
  fetch('/workout/rest-done', { method: 'POST' }).catch(() => {});
  setTimeout(() => {
    section.style.transition = 'opacity 0.6s';
    section.style.opacity = '0';
    setTimeout(() => {
      section.style.display = 'none';
      section.style.opacity = '1';
      section.style.transition = '';
      section.classList.remove('rest-timer-done');
    }, 600);
  }, 2500);
}

function stopRestTimer() {
  if (_restInterval) { clearInterval(_restInterval); _restInterval = null; }
  localStorage.removeItem(_REST_END_KEY);
  const section = document.getElementById('rest-timer-section');
  section.style.display = 'none';
  section.style.opacity = '1';
  section.style.transition = '';
  section.classList.remove('rest-timer-done');
}

async function _loadExerciseSuggestions() {
  try {
    const res = await fetch('/workout/exercises');
    const data = await res.json();
    _exerciseSuggestions = data.exercises;
  } catch (_) {}
}

function _showSuggestions(query) {
  const box = document.getElementById('workout-suggestions');
  if (!query) { box.style.display = 'none'; return; }
  _filteredSuggestions = _exerciseSuggestions.filter(e =>
    e.name.toLowerCase().includes(query.toLowerCase())
  );
  if (!_filteredSuggestions.length) { box.style.display = 'none'; return; }
  box.innerHTML = _filteredSuggestions.map((e, i) => {
    const weight = e.weight ? ` @ ${escapeHtml(e.weight)}` : '';
    const hint = `<span style="color:var(--text-muted);font-size:0.8rem;margin-left:8px">${e.sets}×${e.reps}${weight}</span>`;
    return `<div class="workout-suggestion-item" onmousedown="_pickSuggestion(${i})">${escapeHtml(e.name)}${hint}</div>`;
  }).join('');
  box.style.display = 'block';
}

function _pickSuggestion(i) {
  const ex = _filteredSuggestions[i];
  document.getElementById('workout-name').value = ex.name;
  document.getElementById('workout-sets').value = ex.sets;
  document.getElementById('workout-reps').value = ex.reps;
  document.getElementById('workout-weight').value = ex.weight || '';
  document.getElementById('workout-suggestions').style.display = 'none';
  document.getElementById('workout-sets').focus();
}

function _hideSuggestions() {
  document.getElementById('workout-suggestions').style.display = 'none';
}

async function loadWorkout() {
  clearWorkoutForm();
  document.getElementById('workout-list').innerHTML = loadingHtml();
  try {
    const res = await fetch('/workout/today');
    const data = await res.json();
    renderWorkoutList(data.exercises);
  } catch (_) {
    document.getElementById('workout-list').innerHTML = '<div class="empty-state" style="color:var(--danger)">Failed to load.</div>';
  }
}

async function loadWorkoutHistory() {
  document.getElementById('workout-history').innerHTML = loadingHtml();
  try {
    const res = await fetch('/workout/history');
    const data = await res.json();
    renderWorkoutHistory(data.history);
  } catch (_) {
    document.getElementById('workout-history').innerHTML = '<div class="empty-state" style="color:var(--danger)">Failed to load.</div>';
  }
}

function _exStats(ex) {
  const weight = ex.weight ? ` <span class="ex-x">@</span> <span class="ex-weight">${escapeHtml(ex.weight)}</span>` : '';
  return `<span class="ex-sets">${ex.sets}</span><span class="ex-x">&times;</span><span class="ex-reps">${ex.reps}</span>${weight}`;
}

function _groupExercises(exercises) {
  const groups = [];
  exercises.forEach((ex, flatIndex) => {
    const last = groups[groups.length - 1];
    if (last && last.name === ex.name) {
      last.sets.push({ ...ex, flatIndex });
    } else {
      groups.push({ name: ex.name, sets: [{ ...ex, flatIndex }] });
    }
  });
  return groups;
}

function _mergeIdenticalSets(sets) {
  const merged = [];
  sets.forEach(s => {
    const key = `${s.sets}|${s.reps}|${s.weight || ''}`;
    const last = merged[merged.length - 1];
    if (last && last.key === key) {
      last.items.push(s);
    } else {
      merged.push({ key, items: [s] });
    }
  });
  return merged;
}

function renderWorkoutList(exercises) {
  const el = document.getElementById('workout-list');
  if (!exercises.length) {
    el.innerHTML = '<div class="empty-state">No exercises logged yet.</div>';
    return;
  }
  el.innerHTML = _groupExercises(exercises).map(group => {
    const rows = _mergeIdenticalSets(group.sets).map(sg => {
      const totalSets = sg.items.reduce((acc, s) => acc + s.sets, 0);
      const lastIndex = sg.items[sg.items.length - 1].flatIndex;
      return `<div class="workout-set-row">
        <span class="workout-set-stats">${_exStats({ ...sg.items[0], sets: totalSets })}</span>
        <button class="workout-delete-btn" onclick="deleteExercise(${lastIndex})" title="Remove">&times;</button>
      </div>`;
    }).join('');
    return `<div class="workout-item">
      <span class="workout-item-name">${escapeHtml(group.name)}</span>
      <div class="workout-set-rows">${rows}</div>
    </div>`;
  }).join('');
}

function renderWorkoutHistory(history) {
  const el = document.getElementById('workout-history');
  if (!history.length) {
    el.innerHTML = '<div class="empty-state">No recent workouts.</div>';
    return;
  }
  el.innerHTML = history.map(session => {
    const date = new Date(session.date + 'T00:00:00');
    const label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const cards = _groupExercises(session.exercises).map(group => {
      const rows = _mergeIdenticalSets(group.sets).map(sg => {
        const totalSets = sg.items.reduce((acc, s) => acc + s.sets, 0);
        const s = sg.items[0];
        return `<div class="workout-set-row workout-history-row-clickable"
          data-name="${escapeHtml(group.name)}"
          data-sets="${s.sets}"
          data-reps="${s.reps}"
          data-weight="${escapeHtml(s.weight || '')}"
          onclick="_fillFormFromHistory(this)">
          <span class="workout-set-stats">${_exStats({ ...s, sets: totalSets })}</span>
        </div>`;
      }).join('');
      return `<div class="workout-history-ex">
        <span class="workout-history-ex-name">${escapeHtml(group.name)}</span>
        <div class="workout-set-rows">${rows}</div>
      </div>`;
    }).join('');
    return `<div class="workout-history-session">
      <div class="workout-history-date">${label}</div>
      <div class="workout-history-exercises">${cards}</div>
    </div>`;
  }).join('');
}

async function addExercise(e) {
  e.preventDefault();
  const name = document.getElementById('workout-name').value.trim();
  const sets = parseInt(document.getElementById('workout-sets').value);
  const reps = parseInt(document.getElementById('workout-reps').value);
  const weight = document.getElementById('workout-weight').value.trim() || null;
  const feedback = document.getElementById('workout-feedback');

  try {
    const res = await fetch('/workout/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sets, reps, weight }),
    });
    const data = await res.json();
    if (res.ok) {
      const newWeightNum = _parseWeightNum(weight);
      const existing = _workoutRecords[name];
      const isNewPR = newWeightNum !== null && (
        !existing
        || newWeightNum > existing.weight_num
        || (newWeightNum === existing.weight_num && reps > existing.reps)
      );

      playCompletionFeedback();
      renderWorkoutList(data.exercises);
      feedback.textContent = isNewPR ? '🏆 New personal record!' : '';
      _loadExerciseSuggestions();
      if (isNewPR) loadWorkoutRecords();
      startRestTimer();
      document.getElementById('workout-name').focus();
    } else {
      feedback.textContent = data.error || 'Failed to add.';
    }
  } catch (_) {
    feedback.textContent = 'Request failed.';
  }
}

function _fillFormFromHistory(el) {
  document.getElementById('workout-name').value = el.dataset.name;
  document.getElementById('workout-sets').value = el.dataset.sets;
  document.getElementById('workout-reps').value = el.dataset.reps;
  document.getElementById('workout-weight').value = el.dataset.weight;
  document.getElementById('workout-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('workout-sets').focus();
}

function clearWorkoutForm() {
  document.getElementById('workout-name').value = '';
  document.getElementById('workout-sets').value = '';
  document.getElementById('workout-reps').value = '';
  document.getElementById('workout-weight').value = '';
  document.getElementById('workout-feedback').textContent = '';
  _hideSuggestions();
  document.getElementById('workout-name').focus();
}

async function deleteExercise(index) {
  try {
    const res = await fetch('/workout/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    });
    const data = await res.json();
    if (res.ok) {
      renderWorkoutList(data.exercises);
    }
  } catch (_) {}
}

async function loadWorkoutRecords() {
  try {
    const res = await fetch('/workout/records');
    const data = await res.json();
    _workoutRecords = {};
    for (const r of (data.records || [])) {
      _workoutRecords[r.name] = r;
    }
    _renderWorkoutRecords(data.records || []);
  } catch (_) {
    document.getElementById('workout-records').innerHTML =
      '<div class="empty-state" style="color:var(--danger)">Failed to load.</div>';
  }
}

function _renderWorkoutRecords(records) {
  const el = document.getElementById('workout-records');
  if (!records.length) {
    el.innerHTML = '<div class="empty-state">No records yet.</div>';
    return;
  }
  el.innerHTML = records.map(r => {
    const d = new Date(r.date + 'T12:00:00');
    const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `<div class="workout-record-wrap">
      <div class="workout-record-row"
        data-name="${escapeHtml(r.name)}"
        data-weight="${escapeHtml(r.weight)}"
        data-reps="${r.reps}"
        onclick="_toggleRecordProgress(this)">
        <span class="workout-record-name">${escapeHtml(r.name)}</span>
        <span class="workout-record-weight">${escapeHtml(r.weight)} <span class="ex-x">&times;</span><span class="ex-reps">${r.reps}</span></span>
        <span class="workout-record-date">${dateStr}</span>
        <button class="workout-record-use-btn" title="Fill form"
          onclick="event.stopPropagation(); _useRecordRow(this.closest('.workout-record-row'))">↑</button>
      </div>
      <div class="workout-progress-wrap" style="display:none"></div>
    </div>`;
  }).join('');
}

function _useRecordRow(rowEl) {
  const name = rowEl.dataset.name;
  const weight = rowEl.dataset.weight;
  document.getElementById('workout-name').value = name;
  document.getElementById('workout-weight').value = weight;
  const suggestion = _exerciseSuggestions.find(e => e.name === name);
  if (suggestion) {
    document.getElementById('workout-sets').value = suggestion.sets;
    document.getElementById('workout-reps').value = suggestion.reps;
  }
  document.getElementById('workout-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('workout-sets').focus();
}

function _toggleRecordProgress(rowEl) {
  const wrap = rowEl.nextElementSibling;
  const isOpen = wrap.style.display !== 'none';
  if (isOpen) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  if (wrap.dataset.loaded) return;
  wrap.dataset.loaded = '1';
  const name = rowEl.dataset.name;
  const weight = rowEl.dataset.weight;
  const reps = rowEl.dataset.reps;
  wrap.innerHTML = '<div class="empty-state" style="padding:8px"><span class="spinner"></span></div>';
  fetch(`/workout/progress?exercise=${encodeURIComponent(name)}`)
    .then(r => r.json())
    .then(data => {
      _renderProgressChart(data.progress || [], wrap);
    })
    .catch(() => { wrap.innerHTML = '<div class="empty-state" style="color:var(--danger);padding:8px">Failed to load.</div>'; });
}

function _renderProgressChart(progress, container) {
  if (!progress.length) {
    container.innerHTML = '<div class="empty-state" style="padding:8px">No data.</div>';
    return;
  }

  const W = 400, H = 160;
  const PAD = { top: 10, right: 12, bottom: 32, left: 42 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const n = progress.length;
  const weights = progress.map(p => p.weight_num);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const wRange = maxW - minW || 1;

  const xScale = i => PAD.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const yScale = w => PAD.top + plotH - ((w - minW) / wRange) * plotH;

  const parts = [];

  // Y grid + labels
  for (let i = 0; i <= 4; i++) {
    const w = minW + (wRange * i / 4);
    const y = yScale(w);
    parts.push(`<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${PAD.left + plotW}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="0.5"/>`);
    parts.push(`<text x="${PAD.left - 5}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)" font-family="inherit">${w.toFixed(0)}</text>`);
  }

  // Axes
  parts.push(`<line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + plotH}" stroke="var(--border)" stroke-width="1"/>`);
  parts.push(`<line x1="${PAD.left}" y1="${PAD.top + plotH}" x2="${PAD.left + plotW}" y2="${PAD.top + plotH}" stroke="var(--border)" stroke-width="1"/>`);

  // Day separators + x labels (show date at first set of each new day)
  let prevDate = null;
  progress.forEach((p, i) => {
    if (p.date === prevDate) return;
    const x = xScale(i);
    if (prevDate !== null) {
      parts.push(`<line x1="${x.toFixed(1)}" y1="${PAD.top}" x2="${x.toFixed(1)}" y2="${PAD.top + plotH}" stroke="var(--border)" stroke-width="0.8" stroke-dasharray="3,3"/>`);
    }
    const [, m_, day_] = p.date.split('-');
    parts.push(`<text x="${x.toFixed(1)}" y="${PAD.top + plotH + 14}" text-anchor="middle" font-size="9" fill="var(--text-muted)" font-family="inherit">${day_}.${m_}</text>`);
    prevDate = p.date;
  });

  // Connecting line
  const pts = progress.map((p, i) => `${xScale(i).toFixed(1)},${yScale(p.weight_num).toFixed(1)}`).join(' ');
  parts.push(`<polyline points="${pts}" fill="none" stroke="#a98ef5" stroke-width="1.5" opacity="0.5"/>`);

  // Dots
  progress.forEach((p, i) => {
    const x = xScale(i);
    const y = yScale(p.weight_num);
    const [yr_, m_, day_] = p.date.split('-');
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#a98ef5" opacity="0.9">
      <title>${day_}.${m_}.${yr_}  ${p.weight} × ${p.reps}</title>
    </circle>`);
  });

  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">${parts.join('')}</svg>`;
  const chartEl = document.createElement('div');
  chartEl.className = 'workout-progress-chart';
  chartEl.innerHTML = svg;
  container.innerHTML = '';
  container.appendChild(chartEl);
}

function _parseWeightNum(w) {
  if (!w) return null;
  const m = w.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function loadWorkoutTab() {
  loadWorkout();
  loadWorkoutHistory();
  loadWorkoutRecords();
  _loadExerciseSuggestions();
  _resumeRestTimer();
  const nameInput = document.getElementById('workout-name');
  nameInput.addEventListener('input', e => _showSuggestions(e.target.value));
  nameInput.addEventListener('blur', () => setTimeout(_hideSuggestions, 150));
}
