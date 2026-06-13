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

function obsidianFileHref(relPath) {
  if (!relPath) return null;
  return `obsidian://open?file=${encodeURIComponent(relPath)}`;
}

function openObsidianFile(relPath) {
  if (!relPath) return;
  window.location.href = obsidianFileHref(relPath);
}

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

function playTapFeedback() {
  if (navigator.vibrate) navigator.vibrate(10);
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
    setTimeout(() => ctx.close(), 200);
  } catch (_) {}
}

function playUndoFeedback() {
  if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    play(783, 0, 0.15);
    play(523, 0.12, 0.25);
    setTimeout(() => ctx.close(), 500);
  } catch (_) {}
}

function playCompletionFeedback() {
  if (navigator.vibrate) navigator.vibrate(40);
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    play(523, 0, 0.15);
    play(783, 0.12, 0.25);
    setTimeout(() => ctx.close(), 500);
  } catch (_) {}
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function extractTags(raw) {
  return [...raw.matchAll(/#(\S+)/g)]
    .map(m => m[0])
    .filter(t => t !== '#todo');
}

// ── Tag autocomplete ──────────────────────────────────────────────────────────

let _vaultTags = [];
let _tagDropdownIndex = -1;
let _tagDropdownOnSelect = null;

async function _ensureVaultTags() {
  if (_vaultTags.length) return;
  try {
    const res = await fetch('/vault-tags');
    const data = await res.json();
    _vaultTags = data.tags;
  } catch (_) {}
}

function _showTagSuggestions(inputEl, onSelect) {
  _tagDropdownOnSelect = onSelect;
  const query = inputEl.value.trim().replace(/^#+/, '').toLowerCase();
  const dropdown = document.getElementById('tag-suggestions-dropdown');

  if (!query) { dropdown.style.display = 'none'; return; }

  const matches = _vaultTags.filter(t => t.slice(1).toLowerCase().includes(query)).slice(0, 10);
  if (!matches.length) { dropdown.style.display = 'none'; return; }

  _tagDropdownIndex = -1;
  dropdown.innerHTML = matches.map(t =>
    `<div class="vault-file-option" onclick="_selectTagSuggestion('${escapeHtml(t)}')">${escapeHtml(t)}</div>`
  ).join('');

  const rect = inputEl.getBoundingClientRect();
  dropdown.style.top    = (rect.bottom + 4) + 'px';
  dropdown.style.left   = rect.left + 'px';
  dropdown.style.width  = Math.max(rect.width, 160) + 'px';
  dropdown.style.display = 'block';
}

function _selectTagSuggestion(tag) {
  document.getElementById('tag-suggestions-dropdown').style.display = 'none';
  _tagDropdownIndex = -1;
  if (_tagDropdownOnSelect) _tagDropdownOnSelect(tag);
}

function _hideTagSuggestions() {
  document.getElementById('tag-suggestions-dropdown').style.display = 'none';
  _tagDropdownIndex = -1;
}

function _tagInputKeydown(e, inputEl, onSelect) {
  const dropdown = document.getElementById('tag-suggestions-dropdown');
  if (!dropdown || dropdown.style.display === 'none') return false;
  const items = dropdown.querySelectorAll('.vault-file-option');
  if (!items.length) return false;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _tagDropdownIndex = Math.min(_tagDropdownIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === _tagDropdownIndex));
    items[_tagDropdownIndex]?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    _tagDropdownIndex = Math.max(_tagDropdownIndex - 1, -1);
    items.forEach((el, i) => el.classList.toggle('active', i === _tagDropdownIndex));
    items[_tagDropdownIndex]?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (e.key === 'Enter' && _tagDropdownIndex >= 0) {
    e.preventDefault();
    _selectTagSuggestion(items[_tagDropdownIndex].textContent.trim());
    return true;
  }
  if (e.key === 'Escape') {
    e.stopPropagation();
    _hideTagSuggestions();
    return true;
  }
  return false;
}

function tagBadgeClass(tag) {
  if (tag === '#next')       return 'tag-next';
  if (tag === '#someday')    return 'tag-someday';
  if (tag === '#backburner') return 'tag-backburner';
  if (tag === '#inline')     return 'tag-inline';
  if (tag === '#remind')     return 'tag-remind';
  if (tag.startsWith('#context/')) return 'context';
  return 'tag-other';
}

function _fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function renderTaskBadges(t) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (t.due && t.due < today) || (t.scheduled && t.scheduled < today);
  const started = !overdue && t.start && t.start <= today;
  const scheduledToday = !overdue && t.scheduled === today;
  const dueToday = !overdue && t.due === today;

  const overdueLabel = overdue ? (t.due && t.due < today ? t.due : t.scheduled) : null;
  const overdueBadge  = overdue  ? `<span class="badge overdue">Overdue · ${_fmtDate(overdueLabel)}</span>` : '';
  const startedBadge  = started  ? `<span class="badge started">🛫 ${_fmtDate(t.start)}</span>` : '';
  const dueBadge      = !overdue && t.due       ? `<span class="badge due">📅 ${_fmtDate(t.due)}</span>` : '';
  const schedBadge    = !overdue && t.scheduled ? `<span class="badge scheduled">⏳ ${_fmtDate(t.scheduled)}</span>` : '';
  const timeBadge     = t.time  ? `<span class="badge time">@ ${t.time}</span>` : '';
  const recurBadge    = t.recur ? `<span class="badge recur">🔁 ${t.recur}</span>` : '';

  const tags = t.tags || extractTags(t.task || '');
  const tagBadges = tags.map(tag => {
    const cls = tag === '#next' ? 'tag-next'
      : tag.startsWith('#context/') ? 'context'
      : 'tag-other';
    return `<span class="badge ${cls}">${escapeHtml(tag)}</span>`;
  }).join('');

  const fileBadge = t.rel_path
    ? `<span class="badge file" style="${folderBadgeStyle(t.top_folder)};cursor:pointer" data-path="${escapeHtml(t.rel_path)}" onclick="event.stopPropagation(); openObsidianFile(this.dataset.path)">${escapeHtml(t.file)}</span>`
    : (t.file ? `<span class="badge file" style="${folderBadgeStyle(t.top_folder)}">${escapeHtml(t.file)}</span>` : '');

  const cls = overdue ? ' overdue' : (scheduledToday || dueToday) ? ' scheduled-today' : started ? ' started' : '';

  return {
    html: `${overdueBadge}${startedBadge}${dueBadge}${schedBadge}${timeBadge}${recurBadge}${tagBadges}${fileBadge}`,
    cls,
  };
}

// ── Task edit popup ───────────────────────────────────────────────────────────

let _currentTask = null;
let _taskPopupTags = [];
let _taskPopupSource = null;

function openTaskPopup(task, source) {
  _currentTask = task;
  _taskPopupSource = source;
  _ensureVaultTags();

  document.getElementById('task-popup-description').value = cleanTaskText(task.task);
  document.getElementById('task-popup-due').value = task.due || '';
  document.getElementById('task-popup-scheduled').value = task.scheduled || '';
  document.getElementById('task-popup-start').value = task.start || '';
  document.getElementById('task-popup-time').value = task.time || '';
  document.getElementById('task-popup-recur').value = task.recur || '';
  document.getElementById('task-popup-obsidian-btn').dataset.relPath = task.rel_path || '';

  _taskPopupTags = extractTags(task.task);
  _renderTaskPopupTags();

  const modal = document.getElementById('task-edit-modal');
  modal.style.display = 'flex';
  const desc = document.getElementById('task-popup-description');
  desc.style.height = 'auto';
  desc.style.height = desc.scrollHeight + 'px';
  desc.focus();
}

function closeTaskPopup(e) {
  if (e && e.target !== document.getElementById('task-edit-modal')) return;
  _closeTaskPopup();
}

function _closeTaskPopup() {
  document.getElementById('task-edit-modal').style.display = 'none';
  _currentTask = null;
}

function _renderTaskPopupTags() {
  const container = document.getElementById('task-popup-tags-container');
  const input = document.getElementById('task-popup-tag-input');
  container.querySelectorAll('.inbox-tag-chip').forEach(el => el.remove());
  _taskPopupTags.forEach((tag, i) => {
    const chip = document.createElement('span');
    chip.className = `badge ${tagBadgeClass(tag)} inbox-tag-chip`;
    chip.innerHTML = `${escapeHtml(tag)} <button class="inbox-tag-remove" type="button" onclick="removeTaskPopupTag(${i})">×</button>`;
    container.insertBefore(chip, input);
  });
}

function removeTaskPopupTag(index) {
  _taskPopupTags.splice(index, 1);
  _renderTaskPopupTags();
}

function _buildTaskNewLine() {
  const description = document.getElementById('task-popup-description').value.trim();
  const due = document.getElementById('task-popup-due').value;
  const scheduled = document.getElementById('task-popup-scheduled').value;
  const start = document.getElementById('task-popup-start').value;
  const time = document.getElementById('task-popup-time').value;
  const recur = document.getElementById('task-popup-recur').value;

  const parts = ['- [ ] #todo'];
  if (description) parts.push(description);
  _taskPopupTags.forEach(t => parts.push(t));
  if (due) parts.push(`📅 ${due}`);
  if (scheduled) parts.push(`⏳ ${scheduled}`);
  if (start) parts.push(`🛫 ${start}`);
  if (time) parts.push(`@${time}`);
  if (recur) parts.push(`🔁 ${recur}`);

  return parts.join(' ') + '\n';
}

async function saveTaskPopup() {
  if (!_currentTask) return;
  const newLine = _buildTaskNewLine();
  try {
    const res = await fetch('/task/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rel_path: _currentTask.rel_path,
        raw_line: _currentTask.raw_line,
        new_line: newLine,
      }),
    });
    if (res.ok) {
      _closeTaskPopup();
      if (_taskPopupSource === 'today') loadTasks();
      else if (_taskPopupSource === 'next') loadNextTasks();
      else if (_taskPopupSource === 'upcoming') loadUpcomingTasks();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to save.');
    }
  } catch (_) {
    alert('Request failed.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tagInput = document.getElementById('task-popup-tag-input');
  if (tagInput) {
    const onSelect = tag => {
      if (!_taskPopupTags.includes(tag)) { _taskPopupTags.push(tag); _renderTaskPopupTags(); }
      tagInput.value = '';
      _hideTagSuggestions();
    };
    tagInput.addEventListener('input', () => _showTagSuggestions(tagInput, onSelect));
    tagInput.addEventListener('keydown', e => {
      if (_tagInputKeydown(e, tagInput, onSelect)) return;
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      const val = tagInput.value.trim().replace(/^#+/, '');
      if (!val) return;
      onSelect('#' + val);
    });
  }

  const taskDesc = document.getElementById('task-popup-description');
  if (taskDesc) {
    taskDesc.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
  }

  document.addEventListener('keydown', e => {
    const modal = document.getElementById('task-edit-modal');
    if (!modal || modal.style.display === 'none') return;
    if (e.key === 'Escape') {
      _closeTaskPopup();
    } else if (e.key === 'Enter') {
      const id = e.target.id;
      if (id === 'task-popup-tag-input') return;
      e.preventDefault();
      saveTaskPopup();
    }
  });
});

// ── Tabs ──────────────────────────────────────────────────────────────────────

let planningLoaded = false;
let habitsLoaded = false;
let inboxLoaded = false;
let musicLoaded = false;
let workoutLoaded = false;
let foodLoaded = false;
let financeLoaded = false;

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  localStorage.setItem('activeTab', tab);

  if (tab === 'today') {
    loadTasks();
  }
  if (tab === 'planning' && !planningLoaded) {
    loadNextTasks();
    loadUpcomingTasks();
    planningLoaded = true;
  }
  if (tab === 'inbox' && !inboxLoaded) {
    loadInboxItems();
    inboxLoaded = true;
  }
  if (tab === 'habits' && !habitsLoaded) {
    loadHabits();
    habitsLoaded = true;
  }
  if (tab === 'music' && !musicLoaded) {
    loadMusic();
    musicLoaded = true;
  }
  if (tab === 'workout' && !workoutLoaded) {
    loadWorkoutTab();
    workoutLoaded = true;
  }
  if (tab === 'food' && !foodLoaded) {
    loadFood();
    foodLoaded = true;
  }
  if (tab === 'finance' && !financeLoaded) {
    loadFinance();
    financeLoaded = true;
  }
}
