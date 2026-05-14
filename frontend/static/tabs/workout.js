async function loadWorkout() {
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

function renderWorkoutList(exercises) {
  const el = document.getElementById('workout-list');
  if (!exercises.length) {
    el.innerHTML = '<div class="empty-state">No exercises logged yet.</div>';
    return;
  }
  el.innerHTML = exercises.map((ex, i) => `<div class="workout-item">
      <div class="workout-item-info">
        <span class="workout-item-name">${escapeHtml(ex.name)}</span>
        <span class="workout-item-sets">${_exStats(ex)}</span>
      </div>
      <button class="workout-delete-btn" onclick="deleteExercise(${i})" title="Remove">&times;</button>
    </div>`).join('');
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
    const rows = session.exercises.map(ex => `<div class="workout-history-ex">
        <span class="workout-history-ex-name">${escapeHtml(ex.name)}</span>
        <span class="workout-history-ex-sets">${_exStats(ex)}</span>
      </div>`).join('');
    return `<div class="workout-history-session">
      <div class="workout-history-date">${label}</div>
      <div class="workout-history-exercises">${rows}</div>
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
      renderWorkoutList(data.exercises);
      document.getElementById('workout-name').value = '';
      document.getElementById('workout-sets').value = '';
      document.getElementById('workout-reps').value = '';
      document.getElementById('workout-weight').value = '';
      feedback.textContent = '';
      document.getElementById('workout-name').focus();
    } else {
      feedback.textContent = data.error || 'Failed to add.';
    }
  } catch (_) {
    feedback.textContent = 'Request failed.';
  }
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

function loadWorkoutTab() {
  loadWorkout();
  loadWorkoutHistory();
}
