let nextTasksData = {};
let upcomingTasksData = {};

async function loadNextTasks() {
  const list = document.getElementById('next-tasks-list');
  list.innerHTML = loadingHtml();
  try {
    const res = await fetch('/next-tasks');
    const data = await res.json();
    nextTasksData = data.tasks;
    const tasks = nextTasksData;
    const ids = Object.keys(tasks);
    if (ids.length === 0) {
      list.innerHTML = '<div class="empty-state">No #next tasks.</div>';
      return;
    }
    list.innerHTML = ids.map(id => {
      const t = tasks[id];
      const text = cleanTaskText(t.task);
      const { html: badges, cls } = renderTaskBadges({ ...t, tags: extractTags(t.task).filter(tag => tag !== '#next') });
      return `
        <div class="task-item${cls}" id="next-task-${id}">
          <div class="task-body" style="cursor:pointer" onclick="openTaskPopup(nextTasksData['${id}'], 'next')">
            <div class="task-text">${renderText(text)}</div>
            <div class="task-meta">${badges}</div>
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
    upcomingTasksData = data.tasks;
    const tasks = upcomingTasksData;
    let ids = Object.keys(tasks);
    if (ids.length === 0) {
      list.innerHTML = '<div class="empty-state">No upcoming tasks.</div>';
      return;
    }
    ids.sort((a, b) => tasks[a].happens.localeCompare(tasks[b].happens));
    list.innerHTML = ids.map(id => {
      const t = tasks[id];
      const text = cleanTaskText(t.task);
      const { html: badges, cls } = renderTaskBadges(t);
      return `
        <div class="task-item${cls}" id="upcoming-task-${id}">
          <div class="task-body" style="cursor:pointer" onclick="openTaskPopup(upcomingTasksData['${id}'], 'upcoming')">
            <div class="task-text">${renderText(text)}</div>
            <div class="task-meta">${badges}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty-state" style="color:var(--danger)">Failed to load tasks.</div>`;
  }
}
