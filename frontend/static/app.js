// ── Theme ────────────────────────────────────────────────────────────────────

const savedTheme = localStorage.getItem('theme') || 'catppuccin';
document.documentElement.setAttribute('data-theme', savedTheme);
document.addEventListener('DOMContentLoaded', () => {
  updateThemeIcon(savedTheme);
  applyLogoGlow();
});

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    if (theme === 'catppuccin') icon.src = '/assets/cat-theme.svg';
    else if (theme === 'dark') icon.src = '/assets/dark-theme.svg';
    else icon.src = '/assets/light-theme.svg';
  }

  const logo = document.querySelector('.header-logo');
  if (logo) {
    logo.src = theme === 'catppuccin' ? '/assets/logo-catppuccin.png' : '/assets/logo.png';
  }
}

function applyLogoGlow() {
  const logo = document.querySelector('.header-logo');
  if (!logo) return;
  const glowOn = localStorage.getItem('logoGlow') !== 'off';
  logo.classList.toggle('no-glow', !glowOn);
}

function toggleLogoGlow() {
  const logo = document.querySelector('.header-logo');
  if (!logo) return;
  const glowOn = logo.classList.toggle('no-glow');
  localStorage.setItem('logoGlow', glowOn ? 'off' : 'on');
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'catppuccin' ? 'dark' : current === 'dark' ? 'light' : 'catppuccin';
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

// ── Vault file autocomplete (shared) ─────────────────────────────────────────

let vaultFiles = [];
let _vaultDropdownActiveInput = null;
let _vaultDropdownIndex = -1;

async function _ensureVaultFiles() {
  if (vaultFiles.length) return;
  try {
    const res = await fetch('/vault-files');
    const data = await res.json();
    vaultFiles = data.files;
  } catch (_) {}
}

function _showVaultFileSuggestions(inputEl) {
  _vaultDropdownActiveInput = inputEl;
  _filterVaultFileSuggestions();
}

function _filterVaultFileSuggestions() {
  const input = _vaultDropdownActiveInput;
  const dropdown = document.getElementById('vault-files-dropdown');
  if (!input || !dropdown) return;
  const val = input.value.trim().toLowerCase();
  if (!val) { dropdown.style.display = 'none'; return; }
  const matches = vaultFiles.filter(f => f.toLowerCase().includes(val)).slice(0, 12);
  _vaultDropdownIndex = -1;
  dropdown.innerHTML = matches.length
    ? matches.map(f => `<div class="vault-file-option" onclick="_selectVaultFile('${escapeHtml(f)}')">${escapeHtml(f)}</div>`).join('')
    : `<div class="vault-file-option vault-file-create" onclick="_selectVaultFile(document.getElementById('${escapeHtml(input.id)}').value.trim())">✨ Create: ${escapeHtml(input.value)}</div>`;
  const rect = input.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 4) + 'px';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.width = rect.width + 'px';
  dropdown.style.display = 'block';
}

function _selectVaultFile(path) {
  if (_vaultDropdownActiveInput) _vaultDropdownActiveInput.value = path;
  document.getElementById('vault-files-dropdown').style.display = 'none';
  _vaultDropdownIndex = -1;
}

function _vaultFileInputKeydown(e) {
  const dropdown = document.getElementById('vault-files-dropdown');
  if (!dropdown || dropdown.style.display === 'none') return false;
  const items = dropdown.querySelectorAll('.vault-file-option');
  if (!items.length) return false;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _vaultDropdownIndex = Math.min(_vaultDropdownIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === _vaultDropdownIndex));
    items[_vaultDropdownIndex]?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    _vaultDropdownIndex = Math.max(_vaultDropdownIndex - 1, -1);
    items.forEach((el, i) => el.classList.toggle('active', i === _vaultDropdownIndex));
    items[_vaultDropdownIndex]?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (e.key === 'Enter' && _vaultDropdownIndex >= 0) {
    e.preventDefault();
    _selectVaultFile(items[_vaultDropdownIndex].textContent.trim());
    return true;
  }
  if (e.key === 'Escape') {
    e.stopPropagation();
    dropdown.style.display = 'none';
    _vaultDropdownIndex = -1;
    return true;
  }
  return false;
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
  if (tag === '#buy')        return 'tag-buy';
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
  const startedBadge  = t.start  ? `<span class="badge started">🛫 ${_fmtDate(t.start)}</span>` : '';
  const dueBadge      = !overdue && t.due       ? `<span class="badge due">📅 ${_fmtDate(t.due)}</span>` : '';
  const schedBadge    = !overdue && t.scheduled ? `<span class="badge scheduled">⏳ ${_fmtDate(t.scheduled)}</span>` : '';
  const timeBadge     = t.time  ? `<span class="badge time">@ ${t.time}</span>` : '';
  const recurBadge    = t.recur ? `<span class="badge recur">🔁 ${t.recur}</span>` : '';

  const tags = t.tags || extractTags(t.task || '');
  const tagBadges = tags.map(tag => {
    const cls = tag === '#next' ? 'tag-next'
      : tag === '#buy' ? 'tag-buy'
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

// ── Next action modal ─────────────────────────────────────────────────────────

let _nextActionRelPath = null;
let _nextActionInlineTasks = [];
let _nextActionSelectedRawLine = null;
let _nextActionKbIndex = -1;
let _nextActionTags = [];

async function openNextActionModal(relPath, file) {
  _nextActionRelPath = relPath;
  _nextActionSelectedRawLine = null;
  _nextActionKbIndex = -1;
  _nextActionTags = [];
  _nextActionInlineTasks = [];

  document.getElementById('next-action-description').value = '';
  document.getElementById('next-action-due').value = '';
  document.getElementById('next-action-scheduled').value = '';
  document.getElementById('next-action-start').value = '';
  document.getElementById('next-action-time').value = '';
  document.getElementById('next-action-recur').value = '';
  _renderNextActionTags();

  document.getElementById('next-action-file-badge').textContent = file || '';
  document.getElementById('next-action-inline-section').style.display = 'none';
  document.getElementById('next-action-new-label').textContent = 'Add a next task';
  document.getElementById('next-action-modal').style.display = 'flex';
  _updateNextActionConfirm();
  _ensureVaultTags();

  try {
    const res = await fetch(`/task/inline-tasks?rel_path=${encodeURIComponent(relPath)}`);
    const data = await res.json();
    _nextActionInlineTasks = data.tasks || [];
    if (_nextActionInlineTasks.length) {
      document.getElementById('next-action-inline-section').style.display = 'block';
      document.getElementById('next-action-new-label').textContent = 'Or add a different next task';
      _renderNextActionInlineList();
    }
  } catch (_) {}

  const descEl = document.getElementById('next-action-description');
  descEl.style.height = 'auto';
  descEl.focus();
}

function closeNextActionModal(e) {
  if (e && e.target !== document.getElementById('next-action-modal')) return;
  _closeNextActionModal();
}

function _closeNextActionModal() {
  document.getElementById('next-action-modal').style.display = 'none';
  _nextActionRelPath = null;
  _nextActionSelectedRawLine = null;
  loadNextTasks();
}

function _renderNextActionInlineList() {
  const list = document.getElementById('next-action-inline-list');
  list.innerHTML = _nextActionInlineTasks.map((t, i) => {
    const badges = [
      t.due       ? `<span class="badge due">📅 ${_fmtDate(t.due)}</span>` : '',
      t.scheduled ? `<span class="badge scheduled">⏳ ${_fmtDate(t.scheduled)}</span>` : '',
      t.start     ? `<span class="badge started">🛫 ${_fmtDate(t.start)}</span>` : '',
      t.time      ? `<span class="badge time">@ ${t.time}</span>` : '',
      t.recur     ? `<span class="badge recur">🔁 ${t.recur}</span>` : '',
    ].join('');
    return `
      <button class="next-action-option" tabindex="0" data-index="${i}"
        onclick="_selectNextActionInline(${i})"
        onkeydown="if(event.key==='Enter'){event.preventDefault();_selectNextActionInline(${i});confirmNextAction();}">
        <div class="next-action-option-text">${t.description ? escapeHtml(t.description) : '<span style="color:var(--text-muted)">(no description)</span>'}</div>
        ${badges ? `<div class="task-meta" style="margin-top:5px">${badges}</div>` : ''}
      </button>`;
  }).join('');
}

function _selectNextActionInline(index) {
  _nextActionSelectedRawLine = _nextActionInlineTasks[index]?.raw_line || null;
  _nextActionKbIndex = index;
  document.querySelectorAll('.next-action-option').forEach((el, i) => el.classList.toggle('active', i === index));
  document.getElementById('next-action-description').value = '';
  _updateNextActionConfirm();
}

function _updateNextActionConfirm() {
  const btn = document.getElementById('next-action-confirm-btn');
  if (!btn) return;
  const hasInline = _nextActionSelectedRawLine !== null;
  const hasNew = (document.getElementById('next-action-description')?.value || '').trim().length > 0;
  btn.disabled = !hasInline && !hasNew;
}

function _renderNextActionTags() {
  const container = document.getElementById('next-action-tags-container');
  if (!container) return;
  const input = document.getElementById('next-action-tag-input');
  container.querySelectorAll('.inbox-tag-chip').forEach(el => el.remove());
  _nextActionTags.forEach((tag, i) => {
    const chip = document.createElement('span');
    chip.className = `badge ${tagBadgeClass(tag)} inbox-tag-chip`;
    chip.innerHTML = `${escapeHtml(tag)} <button class="inbox-tag-remove" type="button" onclick="removeNextActionTag(${i})">×</button>`;
    container.insertBefore(chip, input);
  });
}

function removeNextActionTag(index) {
  _nextActionTags.splice(index, 1);
  _renderNextActionTags();
}

async function confirmNextAction() {
  if (!_nextActionRelPath) return;
  const btn = document.getElementById('next-action-confirm-btn');
  if (btn.disabled) return;
  btn.disabled = true;

  try {
    let ok = false;
    if (_nextActionSelectedRawLine) {
      const res = await fetch('/task/promote-inline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rel_path: _nextActionRelPath, raw_line: _nextActionSelectedRawLine }),
      });
      ok = res.ok;
      if (!ok) { const d = await res.json(); alert(d.error || 'Failed.'); }
    } else {
      const description = document.getElementById('next-action-description').value.trim();
      const res = await fetch('/task/add-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rel_path: _nextActionRelPath,
          description,
          tags: _nextActionTags,
          due:       document.getElementById('next-action-due').value,
          scheduled: document.getElementById('next-action-scheduled').value,
          start:     document.getElementById('next-action-start').value,
          time:      document.getElementById('next-action-time').value,
          recur:     document.getElementById('next-action-recur').value,
        }),
      });
      ok = res.ok;
      if (!ok) { const d = await res.json(); alert(d.error || 'Failed.'); }
    }
    if (ok) {
      document.getElementById('next-action-modal').style.display = 'none';
      _nextActionRelPath = null;
      _nextActionSelectedRawLine = null;
      loadNextTasks();
    } else {
      btn.disabled = false;
    }
  } catch (_) {
    alert('Request failed.');
    btn.disabled = false;
  }
}

// ── Task edit popup ───────────────────────────────────────────────────────────

let _currentTask = null;
let _taskPopupTags = [];
let _taskPopupSource = null;

function openTaskPopup(task, source) {
  _currentTask = task;
  _taskPopupSource = source;
  _ensureVaultTags();
  _ensureVaultFiles();

  document.getElementById('task-popup-description').value = cleanTaskText(task.task);
  document.getElementById('task-popup-due').value = task.due || '';
  document.getElementById('task-popup-scheduled').value = task.scheduled || '';
  document.getElementById('task-popup-start').value = task.start || '';
  document.getElementById('task-popup-time').value = task.time || '';
  document.getElementById('task-popup-recur').value = task.recur || '';
  document.getElementById('task-popup-obsidian-btn').dataset.relPath = task.rel_path || '';
  const taskTarget = document.getElementById('task-popup-target');
  if (taskTarget) { taskTarget.value = task.rel_path || ''; }
  document.getElementById('vault-files-dropdown').style.display = 'none';

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

async function deleteTaskPopup() {
  if (!_currentTask) return;
  if (!confirm('Delete this task? This cannot be undone.')) return;
  try {
    const res = await fetch('/task/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel_path: _currentTask.rel_path, raw_line: _currentTask.raw_line }),
    });
    if (res.ok) {
      _closeTaskPopup();
      if (_taskPopupSource === 'today') loadTasks();
      else if (_taskPopupSource === 'next') loadNextTasks();
      else if (_taskPopupSource === 'upcoming') loadUpcomingTasks();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete.');
    }
  } catch (_) { alert('Request failed.'); }
}

async function doneTaskPopup() {
  if (!_currentTask) return;
  try {
    const res = await fetch('/task/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel_path: _currentTask.rel_path, raw_line: _currentTask.raw_line }),
    });
    if (res.ok) {
      playCompletionFeedback();
      _closeTaskPopup();
      if (_taskPopupSource === 'today') loadTasks();
      else if (_taskPopupSource === 'next') loadNextTasks();
      else if (_taskPopupSource === 'upcoming') loadUpcomingTasks();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to complete.');
    }
  } catch (_) { alert('Request failed.'); }
}

async function moveTaskPopup() {
  if (!_currentTask) return;
  const newLine = _buildTaskNewLine();
  const targetPath = (document.getElementById('task-popup-target')?.value || '').trim();
  try {
    const res = await fetch('/task/move-to-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel_path: _currentTask.rel_path, raw_line: _currentTask.raw_line, new_line: newLine, target_path: targetPath }),
    });
    if (res.ok) {
      playCompletionFeedback();
      _closeTaskPopup();
      if (_taskPopupSource === 'today') loadTasks();
      else if (_taskPopupSource === 'next') loadNextTasks();
      else if (_taskPopupSource === 'upcoming') loadUpcomingTasks();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to move.');
    }
  } catch (_) { alert('Request failed.'); }
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
  document.querySelectorAll('input[type="text"], textarea').forEach(el => el.setAttribute('dir', 'auto'));

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

  const taskTargetInput = document.getElementById('task-popup-target');
  if (taskTargetInput) {
    taskTargetInput.addEventListener('input', () => _showVaultFileSuggestions(taskTargetInput));
    taskTargetInput.addEventListener('focus', () => _showVaultFileSuggestions(taskTargetInput));
    taskTargetInput.addEventListener('keydown', e => _vaultFileInputKeydown(e));
  }

  document.addEventListener('click', e => {
    const dropdown = document.getElementById('vault-files-dropdown');
    if (dropdown && !dropdown.contains(e.target) && e.target !== _vaultDropdownActiveInput) {
      dropdown.style.display = 'none';
    }
  });

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
      if (id === 'task-popup-description' && e.shiftKey) return;
      e.preventDefault();
      saveTaskPopup();
    }
  });

  document.addEventListener('keydown', e => {
    const modal = document.getElementById('next-action-modal');
    if (!modal || modal.style.display === 'none') return;

    if (e.key === 'Escape') { _closeNextActionModal(); return; }

    if (e.key === 'Enter' && e.target.id !== 'next-action-description' && e.target.id !== 'next-action-tag-input') {
      e.preventDefault();
      confirmNextAction();
      return;
    }

    const options = document.querySelectorAll('.next-action-option');
    if (!options.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (_nextActionKbIndex < options.length - 1) {
        _selectNextActionInline(_nextActionKbIndex + 1);
        options[_nextActionKbIndex]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (_nextActionKbIndex > 0) {
        _selectNextActionInline(_nextActionKbIndex - 1);
        options[_nextActionKbIndex]?.focus();
      } else if (_nextActionKbIndex === 0) {
        _nextActionSelectedRawLine = null;
        _nextActionKbIndex = -1;
        document.querySelectorAll('.next-action-option').forEach(el => el.classList.remove('active'));
        document.getElementById('next-action-description').focus();
        _updateNextActionConfirm();
      }
    }
  });

  const naDesc = document.getElementById('next-action-description');
  if (naDesc) {
    naDesc.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
      if (_nextActionSelectedRawLine !== null) {
        _nextActionSelectedRawLine = null;
        _nextActionKbIndex = -1;
        document.querySelectorAll('.next-action-option').forEach(el => el.classList.remove('active'));
      }
      _updateNextActionConfirm();
    });
  }

  const naTagInput = document.getElementById('next-action-tag-input');
  if (naTagInput) {
    const onSelect = tag => {
      if (!_nextActionTags.includes(tag)) { _nextActionTags.push(tag); _renderNextActionTags(); }
      naTagInput.value = '';
      _hideTagSuggestions();
    };
    naTagInput.addEventListener('input', () => _showTagSuggestions(naTagInput, onSelect));
    naTagInput.addEventListener('keydown', e => {
      if (_tagInputKeydown(e, naTagInput, onSelect)) return;
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      const val = naTagInput.value.trim().replace(/^#+/, '');
      if (!val) return;
      onSelect('#' + val);
    });
  }
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
