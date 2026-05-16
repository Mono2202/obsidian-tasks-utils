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

// ── Tabs ──────────────────────────────────────────────────────────────────────

let todayLoaded = false;
let planningLoaded = false;
let habitsLoaded = false;
let musicLoaded = false;
let workoutLoaded = false;
let foodLoaded = false;

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  localStorage.setItem('activeTab', tab);

  if (tab === 'today' && !todayLoaded) {
    loadTasks();
    todayLoaded = true;
  }
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
  if (tab === 'workout' && !workoutLoaded) {
    loadWorkoutTab();
    workoutLoaded = true;
  }
  if (tab === 'food' && !foodLoaded) {
    loadFood();
    foodLoaded = true;
  }
}
