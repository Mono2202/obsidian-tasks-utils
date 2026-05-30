const FINANCE_COLORS = {
  'Food':          '#ff6384',
  'Groceries':     '#ff8c42',
  'Transport':     '#36a2eb',
  'Shopping':      '#ff9f40',
  'Entertainment': '#9966ff',
  'Health':        '#4bc0c0',
  'Housing':       '#ffcd56',
  'Utilities':     '#c9cbcf',
  'Gifts':         '#f48fb1',
  'Other':         '#8ac926',
};

function _financeColor(cat) {
  return FINANCE_COLORS[cat] || '#aaaaaa';
}

let _financeMonth = new Date().toISOString().slice(0, 7);
let _financeEntries = [];
let _financeSubscriptions = [];

function financeChangeMonth(delta) {
  const [y, m] = _financeMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta);
  _financeMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  _updateFinanceMonthLabel();
  loadFinanceEntries();
}

function _updateFinanceMonthLabel() {
  const [y, m] = _financeMonth.split('-').map(Number);
  document.getElementById('finance-month-label').textContent =
    new Date(y, m - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// ── Pie chart ─────────────────────────────────────────────────────────────────

function _polarToXY(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function _slicePath(cx, cy, r, startDeg, endDeg) {
  const s = _polarToXY(cx, cy, r, startDeg);
  const e = _polarToXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`;
}

function _renderFinancePie(totals, grandTotal) {
  const svg = document.getElementById('finance-pie-svg');
  const cx = 100, cy = 100, r = 88, hole = 52;
  const parts = [];

  if (grandTotal === 0) {
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--border)"/>`);
  } else {
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 1) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${_financeColor(sorted[0][0])}"/>`);
    } else {
      let angle = 0;
      for (const [cat, amt] of sorted) {
        const sweep = (amt / grandTotal) * 360;
        parts.push(`<path d="${_slicePath(cx, cy, r, angle, angle + sweep)}" fill="${_financeColor(cat)}"/>`);
        angle += sweep;
      }
    }
  }

  parts.push(`<circle cx="${cx}" cy="${cy}" r="${hole}" fill="var(--surface)"/>`);
  if (grandTotal > 0) {
    parts.push(`<text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="14" fill="var(--text)" font-weight="700" font-family="inherit">${grandTotal.toFixed(2)}</text>`);
    parts.push(`<text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="10" fill="var(--text-muted)" font-family="inherit">total</text>`);
  }

  svg.innerHTML = parts.join('');
}

function _renderFinanceLegend(totals, grandTotal) {
  const el = document.getElementById('finance-legend');
  if (grandTotal === 0) { el.innerHTML = ''; return; }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  el.innerHTML = sorted.map(([cat, amt]) => {
    const pct = ((amt / grandTotal) * 100).toFixed(1);
    return `<div class="finance-legend-row">
      <span class="finance-legend-dot" style="background:${_financeColor(cat)}"></span>
      <span class="finance-legend-cat">${escapeHtml(cat)}</span>
      <span class="finance-legend-pct">${pct}%</span>
      <span class="finance-legend-amt">${amt.toFixed(2)}</span>
    </div>`;
  }).join('');
}

// ── Entries list ──────────────────────────────────────────────────────────────

function _isSubEntry(entry) {
  return _financeSubscriptions.some(
    s => s.name === entry.title && s.category === entry.category && s.amount === entry.amount
  );
}

function _renderFinanceEntries(entries) {
  const el = document.getElementById('finance-entries');
  const manual = entries.map((e, i) => ({ ...e, origIdx: i })).filter(e => !_isSubEntry(e));
  if (!manual.length) {
    el.innerHTML = '<div class="empty-state">No entries this month.</div>';
    return;
  }
  el.innerHTML = [...manual].reverse().map(e => {
    const d = new Date(e.date + 'T12:00:00');
    const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `<div class="finance-entry-row">
      <span class="finance-entry-dot" style="background:${_financeColor(e.category)}"></span>
      <span class="finance-entry-date">${dateStr}</span>
      <span class="finance-entry-cat">${escapeHtml(e.category)}</span>
      <span class="finance-entry-title">${escapeHtml(e.title)}</span>
      <span class="finance-entry-amt">${e.amount.toFixed(2)}</span>
      <button class="finance-delete-btn" onclick="deleteFinanceEntry(${e.origIdx})" title="Remove">&times;</button>
    </div>`;
  }).join('');
}

// ── Subscriptions list ────────────────────────────────────────────────────────

function _renderFinanceSubscriptions() {
  const el = document.getElementById('finance-subscriptions');
  const totalEl = document.getElementById('finance-subs-total');
  if (!_financeSubscriptions.length) {
    el.innerHTML = '<div class="empty-state">No subscriptions configured.</div>';
    totalEl.textContent = '';
    return;
  }
  const total = _financeSubscriptions.reduce((s, sub) => s + sub.amount, 0);
  totalEl.textContent = `${total.toFixed(2)} / mo`;
  el.innerHTML = _financeSubscriptions.map(sub => `
    <div class="finance-sub-row">
      <span class="finance-entry-dot" style="background:${_financeColor(sub.category)}"></span>
      <span class="finance-sub-day">Day ${sub.day}</span>
      <span class="finance-sub-cat">${escapeHtml(sub.category)}</span>
      <span class="finance-sub-name">${escapeHtml(sub.name)}</span>
      <span class="finance-entry-amt">${sub.amount.toFixed(2)}</span>
    </div>
  `).join('');
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function _refreshFinanceView() {
  const totals = {};
  let grandTotal = 0;
  for (const e of _financeEntries) {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
    grandTotal += e.amount;
  }
  _renderFinancePie(totals, grandTotal);
  _renderFinanceLegend(totals, grandTotal);
  _renderFinanceEntries(_financeEntries);
}

async function loadFinanceEntries() {
  document.getElementById('finance-entries').innerHTML = loadingHtml();
  document.getElementById('finance-pie-svg').innerHTML = '';
  document.getElementById('finance-legend').innerHTML = '';
  try {
    const res = await fetch(`/finance/entries?month=${_financeMonth}`);
    const data = await res.json();
    _financeEntries = data.entries || [];
    _refreshFinanceView();
  } catch (_) {
    document.getElementById('finance-entries').innerHTML =
      '<div class="empty-state" style="color:var(--danger)">Failed to load.</div>';
  }
}

async function _loadFinanceSubscriptions() {
  try {
    const res = await fetch('/finance/subscriptions');
    const data = await res.json();
    _financeSubscriptions = data.subscriptions || [];
    _renderFinanceSubscriptions();
    _renderFinanceEntries(_financeEntries);  // re-render to apply sub badges
  } catch (_) {
    document.getElementById('finance-subscriptions').innerHTML =
      '<div class="empty-state" style="color:var(--danger)">Failed to load.</div>';
  }
}

function loadFinance() {
  _updateFinanceMonthLabel();
  loadFinanceEntries();
  _loadFinanceSubscriptions();
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function submitFinance(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('finance-amount').value);
  const category = document.getElementById('finance-category').value;
  const title = document.getElementById('finance-title').value.trim();
  const feedback = document.getElementById('finance-feedback');
  feedback.textContent = '';

  try {
    const res = await fetch('/finance/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, category, title, month: _financeMonth }),
    });
    const data = await res.json();
    if (res.ok) {
      playCompletionFeedback();
      _financeEntries = data.entries;
      _refreshFinanceView();
      document.getElementById('finance-amount').value = '';
      document.getElementById('finance-title').value = '';
      document.getElementById('finance-amount').focus();
    } else {
      feedback.textContent = data.error || 'Failed to add.';
    }
  } catch (_) {
    feedback.textContent = 'Request failed.';
  }
}

async function deleteFinanceEntry(index) {
  try {
    const res = await fetch('/finance/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: _financeMonth, index }),
    });
    const data = await res.json();
    if (res.ok) {
      _financeEntries = data.entries;
      _refreshFinanceView();
    }
  } catch (_) {}
}
