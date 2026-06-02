let _exerciseSuggestions = [];
let _filteredSuggestions = [];
let _workoutRecords = {};  // name -> { weight, weight_num, date }

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
        !existing || newWeightNum > existing.weight_num
      );

      playCompletionFeedback();
      renderWorkoutList(data.exercises);
      feedback.textContent = isNewPR ? '🏆 New personal record!' : '';
      _loadExerciseSuggestions();
      if (isNewPR) loadWorkoutRecords();
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
    return `<div class="workout-record-row"
      data-name="${escapeHtml(r.name)}"
      data-weight="${escapeHtml(r.weight)}"
      onclick="_fillFormFromRecord(this)">
      <span class="workout-record-name">${escapeHtml(r.name)}</span>
      <span class="workout-record-weight">${escapeHtml(r.weight)}</span>
      <span class="workout-record-date">${dateStr}</span>
    </div>`;
  }).join('');
}

function _fillFormFromRecord(el) {
  const name = el.dataset.name;
  const weight = el.dataset.weight;
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
  const nameInput = document.getElementById('workout-name');
  nameInput.addEventListener('input', e => _showSuggestions(e.target.value));
  nameInput.addEventListener('blur', () => setTimeout(_hideSuggestions, 150));
}
