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
      const streakHtml = h.streak > 0 ? `<span class="habit-streak">${h.streak} 🔥</span>` : '';
      return `
        <div class="habit-item${doneClass}" id="habit-${CSS.escape(h.name)}">
          <input type="checkbox" class="task-checkbox" ${h.done_today ? 'checked' : ''} onchange="toggleHabit('${safeName}', this)" />
          <div class="habit-body">
            <span class="habit-name${doneClass}">${escapeHtml(h.title)}</span>
            ${descHtml}
          </div>
          ${streakHtml}
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
