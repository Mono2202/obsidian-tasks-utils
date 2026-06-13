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
      const checkbox = t.completable
        ? `<input type="checkbox" class="task-checkbox" onchange="completePlanningTask('${id}', 'next', this)" />`
        : `<span class="task-checkbox" title="Unsupported recurrence"></span>`;
      return `
        <div class="task-item${cls}" id="next-task-${id}">
          ${checkbox}
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
      const checkbox = t.completable
        ? `<input type="checkbox" class="task-checkbox" onchange="completePlanningTask('${id}', 'upcoming', this)" />`
        : `<span class="task-checkbox" title="Unsupported recurrence"></span>`;
      return `
        <div class="task-item${cls}" id="upcoming-task-${id}">
          ${checkbox}
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

async function completePlanningTask(id, source, checkbox) {
  const dataStore = source === 'next' ? nextTasksData : upcomingTasksData;
  const prefix    = source === 'next' ? 'next-task'   : 'upcoming-task';
  const task = dataStore[id];
  if (!task) return;
  const item = document.getElementById(`${prefix}-${id}`);
  if (!item) return;

  item.classList.add('completing');
  try {
    const res = await fetch('/task/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel_path: task.rel_path, raw_line: task.raw_line }),
    });
    if (res.ok) {
      const data = await res.json();
      playCompletionFeedback();
      item.classList.remove('completing');
      item.classList.add('task-done');
      if (source === 'next') openNextActionModal(task.rel_path, task.file);

      const checkboxEl = item.querySelector('.task-checkbox');
      const undoBtn = document.createElement('button');
      undoBtn.className = 'undo-btn';
      undoBtn.textContent = 'Undo';
      checkboxEl.replaceWith(undoBtn);

      const removeItem = () => {
        item.style.transition = 'opacity 0.3s';
        item.style.opacity = '0';
        setTimeout(() => item.remove(), 300);
      };
      const timer = setTimeout(removeItem, 5000);

      undoBtn.onclick = async () => {
        clearTimeout(timer);
        undoBtn.disabled = true;
        try {
          const undoRes = await fetch(`/task/undo-complete/${data.task_id}`, { method: 'POST' });
          if (undoRes.ok) {
            playUndoFeedback();
            item.classList.remove('task-done');
            const newCheckbox = document.createElement('input');
            newCheckbox.type = 'checkbox';
            newCheckbox.className = 'task-checkbox';
            newCheckbox.onchange = function() { completePlanningTask(id, source, this); };
            undoBtn.replaceWith(newCheckbox);
          } else { removeItem(); }
        } catch (_) { removeItem(); }
      };
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to complete task.');
      checkbox.checked = false;
      item.classList.remove('completing');
    }
  } catch (_) {
    checkbox.checked = false;
    item.classList.remove('completing');
  }
}
