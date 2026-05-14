// ── Theme ────────────────────────────────────────────────────────────────────

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.addEventListener('DOMContentLoaded', () => updateThemeIcon(savedTheme));
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) icon.src = theme === 'dark' ? '/assets/dark-theme.svg' : '/assets/light-theme.svg';
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('date-label').textContent = new Date().toLocaleDateString(
  undefined,
  { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
);

// ── Config ───────────────────────────────────────────────────────────────────

const FOLDER_COLORS = {
  'Projects':  '#ffca3a',
  'Inbox':     '#ff595e',
  'Meta':      '#ff924c',
  'Resources': '#1982c4',
  'Areas':     '#8ac926',
  'Spam':      '#6a4c93',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function folderBadgeStyle(folder) {
  const color = FOLDER_COLORS[folder];
  if (!color) return '';
  return `background:${color}22; color:${color}; border:1px solid ${color}55;`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderText(str) {
  const parts = [];
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let last = 0, m;
  while ((m = linkRe.exec(str)) !== null) {
    parts.push(escapeHtml(str.slice(last, m.index)));
    parts.push(`<a href="${escapeHtml(m[2])}" target="_blank" rel="noopener noreferrer">${escapeHtml(m[1])}</a>`);
    last = m.index + m[0].length;
  }
  parts.push(escapeHtml(str.slice(last)));
  return parts.join('');
}

function cleanTaskText(raw) {
  return raw
    .replace(/^-\s\[.\]\s*/, '')
    .replace(/#[^\s]+\s*/g, '')
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/, '')
    .replace(/⏳\s*\d{4}-\d{2}-\d{2}/, '')
    .replace(/🛫\s*\d{4}-\d{2}-\d{2}/, '')
    .replace(/✅\s*\d{4}-\d{2}-\d{2}/, '')
    .replace(/🔁[^📅⏳🛫✅]*/g, '')
    .replace(/⏫|🔼|🔽/, '')
    .replace(/@\d{2}:\d{2}/, '')
    .trim();
}

function extractContextTags(raw) {
  return [...raw.matchAll(/#context\/\S+/g)].map(m => m[0].replace('#context/', ''));
}

function loadingHtml() {
  return '<div class="empty-state"><span class="spinner"></span> Loading...</div>';
}

// ── Today Tab ─────────────────────────────────────────────────────────────────

async function loadTasks() {
  const list = document.getElementById('tasks-list');
  list.innerHTML = loadingHtml();
  try {
    const res = await fetch('/today-tasks');
    const data = await res.json();
    const tasks = data.tasks;
    const today = new Date().toISOString().slice(0, 10);
    let ids = Object.keys(tasks);

    if (ids.length === 0) {
      list.innerHTML = '<div class="empty-state">No tasks for today.</div>';
      return;
    }

    const isOverdue = (t) => (t.due && t.due < today) || (t.scheduled && t.scheduled < today);
    const isStarted = (t) => !isOverdue(t) && t.start && t.start <= today;
    const overdueDate = (t) => (t.due && t.due < today ? t.due : t.scheduled) || '9999';
    const rank = (t) => isOverdue(t) ? 0 : isStarted(t) ? 2 : 1;

    ids.sort((a, b) => {
      const ra = rank(tasks[a]), rb = rank(tasks[b]);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return overdueDate(tasks[a]).localeCompare(overdueDate(tasks[b]));
      return 0;
    });

    list.innerHTML = ids.map(id => {
      const t = tasks[id];
      const text = cleanTaskText(t.task);
      const overdue = isOverdue(t);
      const started = !overdue && t.start && t.start <= today;
      const overdueLabel = overdue ? (t.due && t.due < today ? t.due : t.scheduled) : null;
      const overdueBadge = overdue ? `<span class="badge overdue">Overdue · ${overdueLabel}</span>` : '';
      const startedBadge = started ? `<span class="badge started">Started · ${t.start}</span>` : '';
      const timeBadge = t.time ? `<span class="badge time">@ ${t.time}</span>` : '';
      const fileBadge = `<span class="badge file" style="${folderBadgeStyle(t.top_folder)}">${escapeHtml(t.file)}</span>`;
      const cls = overdue ? ' overdue' : started ? ' started' : '';
      const checkbox = t.completable
        ? `<input type="checkbox" class="task-checkbox" onchange="completeTask('${id}', this)" />`
        : `<span class="task-checkbox" title="Unsupported recurrence"></span>`;
      return `
        <div class="task-item${cls}" id="task-${id}">
          ${checkbox}
          <div class="task-body">
            <div class="task-text">${renderText(text)}</div>
            <div class="task-meta">${overdueBadge}${startedBadge}${timeBadge}${fileBadge}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty-state" style="color:var(--danger)">Failed to load tasks.</div>`;
  }
}

async function completeTask(id, checkbox) {
  const item = document.getElementById(`task-${id}`);
  item.classList.add('completing');
  try {
    const res = await fetch(`/complete-task/${id}`, { method: 'POST' });
    if (res.ok) {
      item.style.transition = 'opacity 0.3s';
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 300);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to complete task.');
      checkbox.checked = false;
      item.classList.remove('completing');
    }
  } catch (e) {
    checkbox.checked = false;
    item.classList.remove('completing');
  }
}

async function submitInbox(e) {
  e.preventDefault();
  const input = document.getElementById('inbox-task');
  const feedback = document.getElementById('inbox-feedback');
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  feedback.textContent = '';
  try {
    const res = await fetch(`/add-task?task=${encodeURIComponent(input.value)}`);
    const data = await res.json();
    if (res.ok) {
      feedback.className = 'feedback ok';
      feedback.textContent = 'Added to Inbox.';
      input.value = '';
    } else {
      feedback.className = 'feedback err';
      feedback.textContent = data.error || 'Error.';
    }
  } catch (e) {
    feedback.className = 'feedback err';
    feedback.textContent = 'Request failed.';
  }
  btn.disabled = false;
}

async function submitToday(e) {
  e.preventDefault();
  const input = document.getElementById('today-task');
  const timeInput = document.getElementById('today-time');
  const feedback = document.getElementById('today-feedback');
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  feedback.textContent = '';
  let url = `/add-today-task?task=${encodeURIComponent(input.value)}`;
  if (timeInput.value) url += `&time=${encodeURIComponent(timeInput.value)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      feedback.className = 'feedback ok';
      feedback.textContent = 'Added to today.';
      input.value = '';
      timeInput.value = '';
      loadTasks();
    } else {
      feedback.className = 'feedback err';
      feedback.textContent = data.error || 'Error.';
    }
  } catch (e) {
    feedback.className = 'feedback err';
    feedback.textContent = 'Request failed.';
  }
  btn.disabled = false;
}

// ── Planning Tab ──────────────────────────────────────────────────────────────

async function loadNextTasks() {
  const list = document.getElementById('next-tasks-list');
  list.innerHTML = loadingHtml();
  try {
    const res = await fetch('/next-tasks');
    const data = await res.json();
    const tasks = data.tasks;
    const ids = Object.keys(tasks);
    if (ids.length === 0) {
      list.innerHTML = '<div class="empty-state">No #next tasks.</div>';
      return;
    }
    list.innerHTML = ids.map(id => {
      const t = tasks[id];
      const text = cleanTaskText(t.task);
      const contextTags = extractContextTags(t.task);
      const contextBadges = contextTags.map(tag => `<span class="badge context">${escapeHtml(tag)}</span>`).join('');
      const fileBadge = `<span class="badge file" style="${folderBadgeStyle(t.top_folder)}">${escapeHtml(t.file)}</span>`;
      return `
        <div class="task-item" id="next-task-${id}">
          <div class="task-body">
            <div class="task-text">${renderText(text)}</div>
            <div class="task-meta">${contextBadges}${fileBadge}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty-state" style="color:var(--danger)">Failed to load tasks.</div>`;
  }
}

async function loadUpcomingTasks() {
  const list = document.getElementById('upcoming-tasks-list');
  list.innerHTML = loadingHtml();
  try {
    const res = await fetch('/upcoming-tasks');
    const data = await res.json();
    const tasks = data.tasks;
    let ids = Object.keys(tasks);
    if (ids.length === 0) {
      list.innerHTML = '<div class="empty-state">No upcoming tasks.</div>';
      return;
    }
    ids.sort((a, b) => tasks[a].happens.localeCompare(tasks[b].happens));
    list.innerHTML = ids.map(id => {
      const t = tasks[id];
      const text = cleanTaskText(t.task);
      const dateBadge = `<span class="badge time">📅 ${t.happens}</span>`;
      const fileBadge = `<span class="badge file" style="${folderBadgeStyle(t.top_folder)}">${escapeHtml(t.file)}</span>`;
      return `
        <div class="task-item" id="upcoming-task-${id}">
          <div class="task-body">
            <div class="task-text">${renderText(text)}</div>
            <div class="task-meta">${dateBadge}${fileBadge}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty-state" style="color:var(--danger)">Failed to load tasks.</div>`;
  }
}

// ── Habits Tab ────────────────────────────────────────────────────────────────

async function loadHabits() {
  const list = document.getElementById('habits-list');
  list.innerHTML = loadingHtml();
  try {
    const res = await fetch('/habits');
    const data = await res.json();
    const habits = data.habits;
    if (habits.length === 0) {
      list.innerHTML = '<div class="empty-state">No habits found.</div>';
      return;
    }
    list.innerHTML = habits.map(h => {
      const doneClass = h.done_today ? ' done' : '';
      const safeName = h.name.replace(/'/g, "\\'");
      const descHtml = h.description ? `<span class="habit-desc">${escapeHtml(h.description)}</span>` : '';
      return `
        <div class="habit-item${doneClass}" id="habit-${CSS.escape(h.name)}">
          <input type="checkbox" class="task-checkbox" ${h.done_today ? 'checked' : ''} onchange="toggleHabit('${safeName}', this)" />
          <div class="habit-body">
            <span class="habit-name${doneClass}">${escapeHtml(h.title)}</span>
            ${descHtml}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty-state" style="color:var(--danger)">Failed to load habits.</div>`;
  }
}

async function toggleHabit(name, checkbox) {
  const item = document.getElementById(`habit-${CSS.escape(name)}`);
  const completing = checkbox.checked;
  item.classList.add('completing');
  const url = completing ? `/complete-habit/${encodeURIComponent(name)}` : `/uncomplete-habit/${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) {
      item.classList.remove('completing');
      item.classList.toggle('done', completing);
      item.querySelector('.habit-name').classList.toggle('done', completing);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update habit.');
      checkbox.checked = !completing;
      item.classList.remove('completing');
    }
  } catch (e) {
    checkbox.checked = !completing;
    item.classList.remove('completing');
  }
}

// ── Music Tab ─────────────────────────────────────────────────────────────────

let _musicRating = 0;
let _musicCurrentTrack = null;
let _musicPollTimer = null;

function _initStarRating() {
  const container = document.getElementById('star-rating');
  container.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.textContent = '★';
    star.dataset.value = i;
    star.addEventListener('click', () => _setMusicRating(i));
    star.addEventListener('mouseenter', () => _highlightStars(i, true));
    star.addEventListener('mouseleave', () => _highlightStars(_musicRating, false));
    container.appendChild(star);
  }
  _highlightStars(0, false);
}

function _highlightStars(n, isHover) {
  document.querySelectorAll('.star').forEach((s, idx) => {
    s.classList.toggle('filled', idx < _musicRating && !isHover);
    s.classList.toggle('hover', idx < n);
  });
  const label = n > 0 ? `${n}/10` : (_musicRating > 0 ? `${_musicRating}/10` : '-/10');
  document.getElementById('music-rating-text').textContent = label;
}

function _setMusicRating(n) {
  _musicRating = (_musicRating === n) ? 0 : n;
  _highlightStars(_musicRating, false);
}

function _showMusicIdle(msg) {
  document.getElementById('music-track-title').textContent = msg || 'Nothing playing';
  document.getElementById('music-track-meta').textContent = '';
  document.getElementById('music-cover').style.display = 'none';
  document.getElementById('music-cover-placeholder').style.display = 'block';
  _resetMusicForm();
  _musicCurrentTrack = null;
}

function _resetMusicForm() {
  _musicRating = 0;
  if (document.getElementById('star-rating').children.length) _highlightStars(0, false);
  document.getElementById('music-notes').value = '';
  document.getElementById('music-status').textContent = '';
  document.getElementById('music-status').className = 'music-status';
}

async function _onMusicTrackChanged(track) {
  document.getElementById('music-track-title').textContent = track.track_name;
  document.getElementById('music-track-meta').textContent = `${track.artist} · ${track.album_name} (${track.release_year})`;

  const img = document.getElementById('music-cover');
  const placeholder = document.getElementById('music-cover-placeholder');
  if (track.cover_url) {
    img.src = track.cover_url;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'block';
  }

  _resetMusicForm();

  try {
    const params = new URLSearchParams({
      track_id: track.track_id,
      track_name: track.track_name,
      track_number: track.track_number,
      artist: track.artist,
      album_name: track.album_name,
      album_id: track.album_id,
      cover_url: track.cover_url,
      release_year: track.release_year,
    });
    const res = await fetch(`/music/get-review?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (data.review) {
        _musicRating = data.review.rating;
        _highlightStars(_musicRating, false);
        document.getElementById('music-notes').value = data.review.notes || '';
      }
    }
  } catch (_) {}
}

async function _pollMusicTrack() {
  try {
    const res = await fetch('/music/current-track');
    const authPrompt = document.getElementById('music-auth-prompt');

    if (res.status === 401) {
      authPrompt.style.display = 'block';
      document.getElementById('music-submit-btn').style.display = 'none';
      _showMusicIdle('');
      document.getElementById('music-track-title').textContent = '';
      return;
    }

    if (res.status === 503) {
      authPrompt.style.display = 'none';
      _showMusicIdle('Spotify not configured.');
      return;
    }

    authPrompt.style.display = 'none';
    document.getElementById('music-submit-btn').style.display = '';

    const data = await res.json();
    if (!data.track) {
      _showMusicIdle();
      return;
    }

    const track = data.track;
    if (!_musicCurrentTrack || _musicCurrentTrack.track_id !== track.track_id) {
      _musicCurrentTrack = track;
      await _onMusicTrackChanged(track);
    }
  } catch (_) {}
}

async function submitMusicReview() {
  if (!_musicCurrentTrack) return;
  if (!_musicRating) {
    _setMusicStatus('Please select a rating.', true);
    return;
  }
  const btn = document.getElementById('music-submit-btn');
  btn.disabled = true;
  _setMusicStatus('Saving…', false);
  try {
    const res = await fetch('/music/submit-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track: _musicCurrentTrack,
        rating: _musicRating,
        notes: document.getElementById('music-notes').value,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      _setMusicStatus('Review saved!', false);
    } else {
      _setMusicStatus(data.error || 'Failed to save.', true);
    }
  } catch (_) {
    _setMusicStatus('Request failed.', true);
  }
  btn.disabled = false;
}

function _setMusicStatus(msg, isError) {
  const el = document.getElementById('music-status');
  el.textContent = msg;
  el.className = 'music-status ' + (isError ? 'err' : 'ok');
}

function loadMusic() {
  _initStarRating();
  _pollMusicTrack();
  if (!_musicPollTimer) {
    _musicPollTimer = setInterval(_pollMusicTrack, 5000);
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

let planningLoaded = false;
let habitsLoaded = false;
let musicLoaded = false;

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');

  if (tab === 'planning' && !planningLoaded) {
    loadNextTasks();
    loadUpcomingTasks();
    planningLoaded = true;
  }
  if (tab === 'habits' && !habitsLoaded) {
    loadHabits();
    habitsLoaded = true;
  }
  if (tab === 'music' && !musicLoaded) {
    loadMusic();
    musicLoaded = true;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

loadTasks();
