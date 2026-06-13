let todayTasks = {};

// _fmtDate is now in app.js

function _updateTasksBadge(n) {
  const badge = document.getElementById('tasks-tab-badge');
  if (badge) { badge.textContent = n; badge.style.display = n > 0 ? 'flex' : 'none'; }
}

function _fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

async function loadTasks() {
  const list = document.getElementById('tasks-list');
  list.innerHTML = loadingHtml();
  try {
    const res = await fetch('/today-tasks');
    const data = await res.json();
    const tasks = data.tasks;
    const today = new Date().toISOString().slice(0, 10);
    todayTasks = tasks;
    let ids = Object.keys(tasks);
    _updateTasksBadge(ids.length);

    if (ids.length === 0) {
      list.innerHTML = '<div class="empty-state">No tasks for today.</div>';
      return;
    }

    const isOverdue = (t) => (t.due && t.due < today) || (t.scheduled && t.scheduled < today);
    const isStarted = (t) => !isOverdue(t) && t.start && t.start <= today;
    const overdueDate = (t) => (t.due && t.due < today ? t.due : t.scheduled) || '9999';
    const rank = (t) => isOverdue(t) ? 0 : isStarted(t) ? 2 : 1;

    ids.sort((a, b) => {
      const ra = rank(tasks[a]), rb = rank(tasks[b]);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return overdueDate(tasks[a]).localeCompare(overdueDate(tasks[b]));
      return 0;
    });

    list.innerHTML = ids.map(id => {
      const t = tasks[id];
      const text = cleanTaskText(t.task);
      const { html: badges, cls } = renderTaskBadges(t);
      const checkbox = t.completable
        ? `<input type="checkbox" class="task-checkbox" onchange="completeTask('${id}', this)" />`
        : `<span class="task-checkbox" title="Unsupported recurrence"></span>`;
      return `
        <div class="task-item${cls}" id="task-${id}">
          ${checkbox}
          <div class="task-body" style="cursor:pointer" onclick="openTaskPopup(todayTasks['${id}'], 'today')">
            <div class="task-text">${renderText(text)}</div>
            <div class="task-meta">${badges}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty-state" style="color:var(--danger)">Failed to load tasks.</div>`;
  }
}

async function completeTask(id, checkbox) {
  const item = document.getElementById(`task-${id}`);
  item.classList.add('completing');
  try {
    const res = await fetch(`/complete-task/${id}`, { method: 'POST' });
    if (res.ok) {
      playCompletionFeedback();
      item.classList.remove('completing');
      item.classList.add('task-done');

      const checkboxEl = item.querySelector('.task-checkbox');
      const undoBtn = document.createElement('button');
      undoBtn.className = 'undo-btn';
      undoBtn.textContent = 'Undo';
      checkboxEl.replaceWith(undoBtn);

      const removeTask = () => {
        item.style.transition = 'opacity 0.3s';
        item.style.opacity = '0';
        setTimeout(() => item.remove(), 300);
      };

      const timer = setTimeout(removeTask, 5000);

      undoBtn.onclick = async () => {
        clearTimeout(timer);
        undoBtn.disabled = true;
        try {
          const undoRes = await fetch(`/undo-complete-task/${id}`, { method: 'POST' });
          if (undoRes.ok) {
            playUndoFeedback();
            item.classList.remove('task-done');
            const newCheckbox = document.createElement('input');
            newCheckbox.type = 'checkbox';
            newCheckbox.className = 'task-checkbox';
            newCheckbox.onchange = function() { completeTask(id, this); };
            undoBtn.replaceWith(newCheckbox);
          } else {
            removeTask();
          }
        } catch (_) {
          removeTask();
        }
      };
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to complete task.');
      checkbox.checked = false;
      item.classList.remove('completing');
    }
  } catch (e) {
    checkbox.checked = false;
    item.classList.remove('completing');
  }
}

async function submitInbox(e) {
  e.preventDefault();
  const input = document.getElementById('inbox-task');
  const remindCheck = document.getElementById('today-remind-check');
  const remindTime = document.getElementById('today-remind-time');
  const feedback = document.getElementById('inbox-feedback');
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  feedback.textContent = '';

  let task = input.value;
  if (remindCheck.checked && remindTime.value) {
    task += ` #remind @${remindTime.value}`;
  }

  try {
    const res = await fetch(`/add-task?task=${encodeURIComponent(task)}`);
    const data = await res.json();
    if (res.ok) {
      feedback.className = 'feedback ok';
      feedback.textContent = 'Added to Inbox.';
      input.value = '';
      remindCheck.checked = false;
      remindTime.value = '';
      remindTime.disabled = true;
    } else {
      feedback.className = 'feedback err';
      feedback.textContent = data.error || 'Error.';
    }
  } catch (e) {
    feedback.className = 'feedback err';
    feedback.textContent = 'Request failed.';
  }
  btn.disabled = false;
}

async function submitToday(e) {
  e.preventDefault();
  const input = document.getElementById('today-task');
  const timeInput = document.getElementById('today-time');
  const feedback = document.getElementById('today-feedback');
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  feedback.textContent = '';
  let url = `/add-today-task?task=${encodeURIComponent(input.value)}`;
  if (timeInput.value) url += `&time=${encodeURIComponent(timeInput.value)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      feedback.className = 'feedback ok';
      feedback.textContent = 'Added to today.';
      input.value = '';
      timeInput.value = '';
      loadTasks();
    } else {
      feedback.className = 'feedback err';
      feedback.textContent = data.error || 'Error.';
    }
  } catch (e) {
    feedback.className = 'feedback err';
    feedback.textContent = 'Request failed.';
  }
  btn.disabled = false;
}
