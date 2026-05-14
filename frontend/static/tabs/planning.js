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
      const fileHref = obsidianFileHref(t.rel_path);
      const fileBadge = fileHref
        ? `<a href="${fileHref}" class="badge file" style="${folderBadgeStyle(t.top_folder)}">${escapeHtml(t.file)}</a>`
        : `<span class="badge file" style="${folderBadgeStyle(t.top_folder)}">${escapeHtml(t.file)}</span>`;
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
      const fileHref = obsidianFileHref(t.rel_path);
      const fileBadge = fileHref
        ? `<a href="${fileHref}" class="badge file" style="${folderBadgeStyle(t.top_folder)}">${escapeHtml(t.file)}</a>`
        : `<span class="badge file" style="${folderBadgeStyle(t.top_folder)}">${escapeHtml(t.file)}</span>`;
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
