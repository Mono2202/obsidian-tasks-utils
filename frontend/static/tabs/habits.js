const _habitEntries = {};

// ── Shared heatmap helpers ────────────────────────────────────────────────────

function _heatmapWeeks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setMonth(start.getMonth() - 6);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // align to Monday

  const weeks = [];
  const cur = new Date(start);
  while (cur <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().slice(0, 10);
      if (cur <= today) week.push(iso);
      cur.setDate(cur.getDate() + 1);
    }
    if (week.length) weeks.push(week);
  }
  return weeks;
}

function _heatmapSvg(weeks, cellColor) {
  // cellColor(iso) → { fill, opacity }
  const cs = 11, gap = 2, step = cs + gap;
  const padT = 16;
  const W = weeks.length * step, H = padT + 7 * step;
  const parts = [];

  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const d = new Date(week[0] + 'T12:00:00');
    const m = d.getMonth();
    if (m !== lastMonth) {
      parts.push(`<text x="${wi * step}" y="11" font-size="9" fill="var(--text-muted)" font-family="inherit">${d.toLocaleDateString(undefined, { month: 'short' })}</text>`);
      lastMonth = m;
    }
  });

  weeks.forEach((week, wi) => {
    week.forEach((iso, di) => {
      const { fill, opacity, title } = cellColor(iso);
      parts.push(`<rect x="${wi * step}" y="${padT + di * step}" width="${cs}" height="${cs}" rx="2" fill="${fill}" opacity="${opacity}"><title>${title}</title></rect>`);
    });
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

function _scrollToEnd(el) {
  requestAnimationFrame(() => {
    const s = el.querySelector('.habit-heatmap-scroll');
    if (s) s.scrollLeft = s.scrollWidth;
  });
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadHabits() {
  const list = document.getElementById('habits-list');
  list.innerHTML = loadingHtml();
  try {
    const res = await fetch('/habits');
    const data = await res.json();
    const habits = data.habits;

    _renderOverallHeatmap(habits);

    if (habits.length === 0) {
      list.innerHTML = '<div class="empty-state">No habits found.</div>';
      return;
    }
    habits.forEach(h => { _habitEntries[h.name] = h.entries; });
    list.innerHTML = habits.map(h => {
      const doneClass = h.done_today ? ' done' : '';
      const safeName = h.name.replace(/'/g, "\\'");
      const escapedName = CSS.escape(h.name);
      const descHtml = h.description ? `<span class="habit-desc">${escapeHtml(h.description)}</span>` : '';
      const streakHtml = h.streak > 0 ? `<span class="habit-streak">${h.streak} 🔥</span>` : '';
      return `
        <div class="habit-wrap">
          <div class="habit-item${doneClass}" id="habit-${escapedName}">
            <input type="checkbox" class="task-checkbox" ${h.done_today ? 'checked' : ''} onchange="toggleHabit('${safeName}', this)" />
            <div class="habit-body" onclick="_toggleHabitHeatmap('${safeName}')">
              <span class="habit-name${doneClass}">${escapeHtml(h.title)}</span>
              ${descHtml}
            </div>
            ${streakHtml}
          </div>
          <div class="habit-heatmap-wrap" id="heatmap-${escapedName}" style="display:none"></div>
        </div>`;
    }).join('');
  } catch (e) {
    document.getElementById('habits-overall-heatmap').innerHTML =
      '<div class="empty-state" style="color:var(--danger)">Failed to load.</div>';
    list.innerHTML = `<div class="empty-state" style="color:var(--danger)">Failed to load habits.</div>`;
  }
}

// ── Overall heatmap ───────────────────────────────────────────────────────────

function _renderOverallHeatmap(habits) {
  const el = document.getElementById('habits-overall-heatmap');
  const total = habits.length;
  if (!total) { el.innerHTML = '<div class="empty-state">No habits.</div>'; return; }

  const counts = {};
  habits.forEach(h => (h.entries || []).forEach(d => { counts[d] = (counts[d] || 0) + 1; }));

  const weeks = _heatmapWeeks();
  const svg = _heatmapSvg(weeks, iso => {
    const count = counts[iso] || 0;
    const ratio = count / total;
    return {
      fill: count === 0 ? 'var(--border)' : '#22c55e',
      opacity: count === 0 ? '0.3' : (0.2 + ratio * 0.8).toFixed(2),
      title: `${iso}: ${count}/${total}`,
    };
  });

  el.innerHTML = `<div class="habit-heatmap-scroll">${svg}</div>`;
  _scrollToEnd(el);
}

// ── Per-habit heatmap ─────────────────────────────────────────────────────────

function _toggleHabitHeatmap(name) {
  const wrap = document.getElementById(`heatmap-${CSS.escape(name)}`);
  const isOpen = wrap.style.display !== 'none';
  if (isOpen) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  _renderHabitHeatmap(name);
}

function _renderHabitHeatmap(name) {
  const container = document.getElementById(`heatmap-${CSS.escape(name)}`);
  const done = new Set(_habitEntries[name] || []);
  const todayIso = new Date().toISOString().slice(0, 10);

  const weeks = _heatmapWeeks();
  const svg = _heatmapSvg(weeks, iso => {
    const isDone = done.has(iso);
    const isFuture = iso > todayIso;
    const isToday = iso === todayIso;
    return {
      fill: isDone ? '#22c55e' : 'var(--border)',
      opacity: isDone ? '0.9' : (isFuture ? '0.15' : '0.35'),
      title: iso,
    };
  });

  container.innerHTML = `<div class="habit-heatmap-scroll">${svg}</div>`;
  _scrollToEnd(container);
}

// ── Toggle habit ──────────────────────────────────────────────────────────────

async function toggleHabit(name, checkbox) {
  const item = document.getElementById(`habit-${CSS.escape(name)}`);
  const completing = checkbox.checked;
  item.classList.add('completing');
  const url = completing ? `/complete-habit/${encodeURIComponent(name)}` : `/uncomplete-habit/${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) {
      if (completing) playCompletionFeedback(); else playUndoFeedback();
      item.classList.remove('completing');
      item.classList.toggle('done', completing);
      item.querySelector('.habit-name').classList.toggle('done', completing);
      const data = await res.json();
      const streakEl = item.querySelector('.habit-streak');
      if (data.streak > 0) {
        if (streakEl) streakEl.textContent = `${data.streak} 🔥`;
        else item.insertAdjacentHTML('beforeend', `<span class="habit-streak">${data.streak} 🔥</span>`);
      } else {
        if (streakEl) streakEl.remove();
      }
      const today = new Date().toISOString().slice(0, 10);
      if (completing) _habitEntries[name] = [...(_habitEntries[name] || []), today];
      else _habitEntries[name] = (_habitEntries[name] || []).filter(d => d !== today);
      const heatmap = document.getElementById(`heatmap-${CSS.escape(name)}`);
      if (heatmap && heatmap.style.display !== 'none') _renderHabitHeatmap(name);
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
