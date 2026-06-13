// ── State ────────────────────────────────────────────────────────────────────

let inboxItems = [];
let currentInboxItem = null;
let inboxSortNewest = true;
let inboxRelPath = null;
let vaultFiles = [];
let popupTags = [];

// ── Panel ─────────────────────────────────────────────────────────────────────

async function loadInboxItems() {
  const list = document.getElementById('inbox-list');
  list.innerHTML = loadingHtml();
  try {
    const res = await fetch('/inbox-items');
    const data = await res.json();
    inboxItems = data.items;
    inboxRelPath = data.inbox_rel_path;
    _updateInboxBadge(inboxItems.length);
    renderInboxItems();
    if (vaultFiles.length === 0) _loadVaultFiles();
  } catch (e) {
    list.innerHTML = `<div class="empty-state" style="color:var(--danger)">Failed to load inbox.</div>`;
  }
}

function _updateInboxBadge(n) {
  const badge = document.getElementById('inbox-count-badge');
  const tabBadge = document.getElementById('inbox-tab-badge');
  if (badge) { badge.textContent = n; badge.style.display = n > 0 ? '' : 'none'; }
  if (tabBadge) { tabBadge.textContent = n; tabBadge.style.display = n > 0 ? 'flex' : 'none'; }
}

function filterInboxItems() {
  renderInboxItems();
}

function toggleInboxSort() {
  inboxSortNewest = !inboxSortNewest;
  document.getElementById('inbox-sort-btn').textContent = inboxSortNewest ? '↓' : '↑';
  renderInboxItems();
}

function renderInboxItems() {
  const list = document.getElementById('inbox-list');
  const filterVal = (document.getElementById('inbox-filter').value || '').toLowerCase();

  let items = [...inboxItems];

  if (filterVal) {
    items = items.filter(item =>
      item.description.toLowerCase().includes(filterVal) ||
      item.tags.some(t => t.toLowerCase().includes(filterVal))
    );
  }

  if (inboxSortNewest) items = items.slice().reverse();

  if (items.length === 0) {
    list.innerHTML = filterVal
      ? '<div class="empty-state">No items match your search.</div>'
      : '<div class="empty-state">Inbox is empty. 🎉</div>';
    return;
  }

  list.innerHTML = items.map(item => {
    const tags = item.tags.map(t => `<span class="badge context">${escapeHtml(t)}</span>`).join('');
    const dueBadge = item.due ? `<span class="badge due">📅 ${item.due}</span>` : '';
    const schedBadge = item.scheduled ? `<span class="badge scheduled">⏳ ${item.scheduled}</span>` : '';
    const timeBadge = item.time ? `<span class="badge time">@ ${item.time}</span>` : '';
    const recurBadge = item.recur ? `<span class="badge recur">🔁 ${item.recur}</span>` : '';
    const id = escapeHtml(item.id);
    return `
      <div class="task-item inbox-item" id="inbox-item-${id}">
        <input type="checkbox" class="task-checkbox" title="Complete and move to tasks"
          onchange="completeInboxItem('${id}')" />
        <div class="task-body" style="cursor:pointer" onclick="openInboxPopup('${id}')">
          <div class="task-text">${item.description ? escapeHtml(item.description) : '<span style="color:var(--text-muted)">(no description)</span>'}</div>
          <div class="task-meta">${tags}${dueBadge}${schedBadge}${timeBadge}${recurBadge}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Quick add ─────────────────────────────────────────────────────────────────

async function quickAddInboxItem(e) {
  e.preventDefault();
  const input = document.getElementById('inbox-quick-input');
  const remindCheck = document.getElementById('inbox-remind-check');
  const remindTime = document.getElementById('inbox-remind-time');
  const feedback = document.getElementById('inbox-quick-feedback');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  feedback.textContent = '';

  let description = input.value;
  if (remindCheck.checked && remindTime.value) {
    description += ` #remind @${remindTime.value}`;
  }

  try {
    const res = await fetch('/inbox/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    const data = await res.json();
    if (res.ok) {
      feedback.className = 'feedback ok';
      feedback.textContent = 'Added to inbox.';
      input.value = '';
      remindCheck.checked = false;
      remindTime.value = '';
      remindTime.disabled = true;
      await loadInboxItems();
    } else {
      feedback.className = 'feedback err';
      feedback.textContent = data.error || 'Error.';
    }
  } catch (_) {
    feedback.className = 'feedback err';
    feedback.textContent = 'Request failed.';
  }
  btn.disabled = false;
}

// ── Open in Obsidian ──────────────────────────────────────────────────────────

function openObsidianInbox() {
  if (inboxRelPath) openObsidianFile(inboxRelPath);
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function openInboxPopup(id) {
  currentInboxItem = inboxItems.find(i => i.id === id);
  if (!currentInboxItem) return;

  document.getElementById('popup-description').value = currentInboxItem.description || '';
  document.getElementById('popup-due').value = currentInboxItem.due || '';
  document.getElementById('popup-scheduled').value = currentInboxItem.scheduled || '';
  document.getElementById('popup-start').value = currentInboxItem.start || '';
  document.getElementById('popup-time').value = currentInboxItem.time || '';
  document.getElementById('popup-recur').value = currentInboxItem.recur || '';
  document.getElementById('popup-target').value = '';
  document.getElementById('vault-files-dropdown').style.display = 'none';

  popupTags = [...currentInboxItem.tags];
  _renderPopupTags();

  document.getElementById('inbox-modal').style.display = 'flex';
  document.getElementById('popup-description').focus();
}

function closeInboxPopup(e) {
  if (e && e.target !== document.getElementById('inbox-modal')) return;
  _closeInboxPopup();
}

function _closeInboxPopup() {
  document.getElementById('inbox-modal').style.display = 'none';
  document.getElementById('vault-files-dropdown').style.display = 'none';
  currentInboxItem = null;
}

// ── Tags ──────────────────────────────────────────────────────────────────────

function _renderPopupTags() {
  const container = document.getElementById('popup-tags-container');
  const input = document.getElementById('popup-tag-input');
  container.querySelectorAll('.inbox-tag-chip').forEach(el => el.remove());
  popupTags.forEach((tag, i) => {
    const chip = document.createElement('span');
    chip.className = 'badge context inbox-tag-chip';
    chip.innerHTML = `${escapeHtml(tag)} <button class="inbox-tag-remove" type="button" onclick="removePopupTag(${i})">×</button>`;
    container.insertBefore(chip, input);
  });
}

function removePopupTag(index) {
  popupTags.splice(index, 1);
  _renderPopupTags();
}

document.addEventListener('DOMContentLoaded', () => {
  const tagInput = document.getElementById('popup-tag-input');
  if (!tagInput) return;
  tagInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const val = tagInput.value.trim().replace(/^#+/, '');
    if (!val) return;
    const tag = '#' + val;
    if (!popupTags.includes(tag)) {
      popupTags.push(tag);
      _renderPopupTags();
    }
    tagInput.value = '';
  });

  document.addEventListener('click', e => {
    const dropdown = document.getElementById('vault-files-dropdown');
    const input = document.getElementById('popup-target');
    if (dropdown && input && !dropdown.contains(e.target) && e.target !== input) {
      dropdown.style.display = 'none';
    }
  });
});

// ── Build task line ───────────────────────────────────────────────────────────

function _buildNewLine() {
  const description = document.getElementById('popup-description').value.trim();
  const due = document.getElementById('popup-due').value;
  const scheduled = document.getElementById('popup-scheduled').value;
  const start = document.getElementById('popup-start').value;
  const time = document.getElementById('popup-time').value;
  const recur = document.getElementById('popup-recur').value;

  const parts = ['- [ ] #todo'];
  if (description) parts.push(description);
  popupTags.forEach(t => parts.push(t));
  if (due) parts.push(`📅 ${due}`);
  if (scheduled) parts.push(`⏳ ${scheduled}`);
  if (start) parts.push(`🛫 ${start}`);
  if (time) parts.push(`@${time}`);
  if (recur) parts.push(`🔁 ${recur}`);

  return parts.join(' ') + '\n';
}

function _updatedItemState(newLine) {
  return {
    ...currentInboxItem,
    raw_line: newLine,
    description: document.getElementById('popup-description').value.trim(),
    tags: [...popupTags],
    due: document.getElementById('popup-due').value || null,
    scheduled: document.getElementById('popup-scheduled').value || null,
    start: document.getElementById('popup-start').value || null,
    time: document.getElementById('popup-time').value || null,
    recur: document.getElementById('popup-recur').value || null,
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function saveInboxItem() {
  if (!currentInboxItem) return;
  const newLine = _buildNewLine();
  try {
    const res = await fetch('/inbox/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_line: currentInboxItem.raw_line, new_line: newLine }),
    });
    if (res.ok) {
      const idx = inboxItems.findIndex(i => i.id === currentInboxItem.id);
      if (idx >= 0) inboxItems[idx] = _updatedItemState(newLine);
      renderInboxItems();
      _closeInboxPopup();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to save.');
    }
  } catch (_) {
    alert('Request failed.');
  }
}

async function moveInboxItem() {
  if (!currentInboxItem) return;
  const newLine = _buildNewLine();
  const targetPath = document.getElementById('popup-target').value.trim();
  try {
    const res = await fetch('/inbox/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_line: currentInboxItem.raw_line, new_line: newLine, target_path: targetPath }),
    });
    if (res.ok) {
      playCompletionFeedback();
      inboxItems = inboxItems.filter(i => i.id !== currentInboxItem.id);
      _updateInboxBadge(inboxItems.length);
      renderInboxItems();
      _closeInboxPopup();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to move.');
    }
  } catch (_) {
    alert('Request failed.');
  }
}

async function deleteInboxItem() {
  if (!currentInboxItem) return;
  if (!confirm('Delete this inbox item? This cannot be undone.')) return;
  try {
    const res = await fetch('/inbox/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_line: currentInboxItem.raw_line }),
    });
    if (res.ok) {
      inboxItems = inboxItems.filter(i => i.id !== currentInboxItem.id);
      _updateInboxBadge(inboxItems.length);
      renderInboxItems();
      _closeInboxPopup();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete.');
    }
  } catch (_) {
    alert('Request failed.');
  }
}

async function completeInboxItem(id) {
  const item = inboxItems.find(i => i.id === id);
  if (!item) return;
  const el = document.getElementById(`inbox-item-${id}`);
  if (el) el.style.opacity = '0.4';
  try {
    const res = await fetch('/inbox/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_line: item.raw_line }),
    });
    if (res.ok) {
      playCompletionFeedback();
      inboxItems = inboxItems.filter(i => i.id !== id);
      _updateInboxBadge(inboxItems.length);
      renderInboxItems();
    } else {
      if (el) el.style.opacity = '';
      const data = await res.json();
      alert(data.error || 'Failed to complete.');
    }
  } catch (_) {
    if (el) el.style.opacity = '';
    alert('Request failed.');
  }
}

// ── Vault autocomplete ────────────────────────────────────────────────────────

async function _loadVaultFiles() {
  try {
    const res = await fetch('/vault-files');
    const data = await res.json();
    vaultFiles = data.files;
  } catch (_) {
    vaultFiles = [];
  }
}

function showVaultDropdown() {
  filterVaultFiles();
}

function filterVaultFiles() {
  const input = document.getElementById('popup-target');
  const dropdown = document.getElementById('vault-files-dropdown');
  const val = input.value.trim().toLowerCase();

  if (!val) {
    dropdown.style.display = 'none';
    return;
  }

  const matches = vaultFiles.filter(f => f.toLowerCase().includes(val)).slice(0, 12);

  if (matches.length === 0) {
    dropdown.innerHTML = `<div class="vault-file-option vault-file-create" onclick="selectVaultFile(document.getElementById('popup-target').value.trim())">✨ Create: ${escapeHtml(input.value)}</div>`;
  } else {
    dropdown.innerHTML = matches
      .map(f => `<div class="vault-file-option" onclick="selectVaultFile('${escapeHtml(f)}')">${escapeHtml(f)}</div>`)
      .join('');
  }
  dropdown.style.display = 'block';
}

function selectVaultFile(path) {
  document.getElementById('popup-target').value = path;
  document.getElementById('vault-files-dropdown').style.display = 'none';
}
