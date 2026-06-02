/* ============================================================
   TASKFLOW — app.js
   Interactive To-Do List Application
   ============================================================ */

'use strict';

/* ── Constants ─────────────────────────────────────────── */
const STATUS = { PENDING: 'pending', INPROGRESS: 'inprogress', DONE: 'done' };

const STATUS_CYCLE = {
  [STATUS.PENDING]:    STATUS.INPROGRESS,
  [STATUS.INPROGRESS]: STATUS.DONE,
  [STATUS.DONE]:       STATUS.PENDING,
};

const STATUS_ICON = {
  [STATUS.PENDING]:    '',          // empty circle (CSS handles it)
  [STATUS.INPROGRESS]: 'bi-dash-lg',
  [STATUS.DONE]:       'bi-check-lg',
};

const STATUS_LABEL = {
  [STATUS.PENDING]:    'Pending',
  [STATUS.INPROGRESS]: 'In Progress',
  [STATUS.DONE]:       'Done',
};

const STATUS_BADGE_CLASS = {
  [STATUS.PENDING]:    'badge-pending',
  [STATUS.INPROGRESS]: 'badge-inprogress',
  [STATUS.DONE]:       'badge-done',
};

const NEXT_STATUS_HINT = {
  [STATUS.PENDING]:    'Mark In Progress',
  [STATUS.INPROGRESS]: 'Mark Done',
  [STATUS.DONE]:       'Reset to Pending',
};

const STORAGE_KEY = 'taskflow_tasks';

/* ── State ─────────────────────────────────────────────── */
let tasks  = [];           // { id, text, status, createdAt }
let filter = 'all';        // 'all' | 'pending' | 'inprogress' | 'done'

/* ── DOM References ────────────────────────────────────── */
const taskInput      = document.getElementById('taskInput');
const addTaskBtn     = document.getElementById('addTaskBtn');
const errorMsg       = document.getElementById('errorMsg');
const charCount      = document.getElementById('charCount');
const charCounter    = document.querySelector('.char-counter');
const taskList       = document.getElementById('taskList');
const emptyState     = document.getElementById('emptyState');
const footerActions  = document.getElementById('footerActions');
const clearDoneBtn   = document.getElementById('clearDoneBtn');
const numTotal       = document.getElementById('numTotal');
const numInProgress  = document.getElementById('numInProgress');
const numDone        = document.getElementById('numDone');
const filterTabs     = document.querySelectorAll('.filter-tab');
const toastEl        = document.getElementById('liveToast');
const toastBody      = document.getElementById('toastBody');

/* ── Utilities ─────────────────────────────────────────── */

/** Generate a unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Format a Date object as a friendly timestamp */
function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/** Escape HTML to prevent XSS */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/** Show a toast notification */
function showToast(message, type = 'default') {
  toastBody.textContent = message;

  // Colour the toast by type
  toastEl.style.background = type === 'delete'  ? '#c84b2f'
                            : type === 'success' ? '#4a7c59'
                            : '#1a1714';

  const bsToast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2200 });
  bsToast.show();
}

/* ── Persistence ───────────────────────────────────────── */

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    // localStorage unavailable — silently continue
  }
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) tasks = JSON.parse(raw);
  } catch (e) {
    tasks = [];
  }
}

/* ── Validation ────────────────────────────────────────── */

/**
 * Validate the task input.
 * Returns { valid: Boolean, message: String }
 */
function validateInput(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, message: 'Task cannot be empty.' };
  }
  if (trimmed.length < 2) {
    return { valid: false, message: 'Task must be at least 2 characters.' };
  }
  if (trimmed.length > 120) {
    return { valid: false, message: 'Task cannot exceed 120 characters.' };
  }

  // Duplicate check (case-insensitive, same status group as pending)
  const lower = trimmed.toLowerCase();
  const isDuplicate = tasks.some(
    t => t.text.toLowerCase() === lower && t.status !== STATUS.DONE
  );
  if (isDuplicate) {
    return { valid: false, message: 'This task already exists.' };
  }

  return { valid: true, message: '' };
}

/** Show or clear the inline error message */
function showError(message) {
  errorMsg.textContent = message;
  if (message) {
    errorMsg.classList.add('visible');
    taskInput.setAttribute('aria-invalid', 'true');
  } else {
    errorMsg.classList.remove('visible');
    taskInput.removeAttribute('aria-invalid');
  }
}

/* ── Core CRUD ─────────────────────────────────────────── */

function addTask(text) {
  const task = {
    id:        uid(),
    text:      text.trim(),
    status:    STATUS.PENDING,
    createdAt: new Date().toISOString(),
  };
  tasks.unshift(task);     // newest first
  saveTasks();
  renderAll();
  showToast('Task added!', 'default');
}

function deleteTask(id) {
  const item = document.querySelector(`[data-id="${id}"]`);
  if (item) {
    item.classList.add('removing');
    item.addEventListener('animationend', () => {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderAll();
    }, { once: true });
  }
  showToast('Task deleted.', 'delete');
}

function cycleStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = STATUS_CYCLE[task.status];
  saveTasks();
  renderAll();
}

function clearDone() {
  const count = tasks.filter(t => t.status === STATUS.DONE).length;
  if (count === 0) return;
  tasks = tasks.filter(t => t.status !== STATUS.DONE);
  saveTasks();
  renderAll();
  showToast(`Cleared ${count} completed task${count > 1 ? 's' : ''}.`, 'success');
}

/* ── Rendering ─────────────────────────────────────────── */

/** Build the HTML for a single task item */
function buildTaskHTML(task) {
  const iconClass   = STATUS_ICON[task.status];
  const iconHTML    = iconClass ? `<i class="bi ${iconClass}"></i>` : '';
  const badgeClass  = STATUS_BADGE_CLASS[task.status];
  const badgeLabel  = STATUS_LABEL[task.status];
  const hint        = NEXT_STATUS_HINT[task.status];

  return `
    <li class="task-item status-${task.status}" data-id="${task.id}" data-status="${task.status}">
      <div class="d-flex flex-column align-items-center gap-1">
        <button
          class="task-status-btn"
          title="${hint}"
          aria-label="${hint} for task: ${escapeHtml(task.text)}"
          onclick="cycleStatus('${task.id}')"
        >${iconHTML}</button>
        <span class="status-cycle-label" style="font-size:9px;color:var(--ink-faint);writing-mode:horizontal-tb">&nbsp;</span>
      </div>

      <div class="task-body">
        <p class="task-text">${escapeHtml(task.text)}</p>
        <div class="task-meta">
          <span class="status-badge ${badgeClass}">${badgeLabel}</span>
          <span class="task-timestamp">${formatTime(task.createdAt)}</span>
        </div>
      </div>

      <div class="task-actions">
        <button
          class="action-btn delete-btn"
          title="Delete task"
          aria-label="Delete task: ${escapeHtml(task.text)}"
          onclick="deleteTask('${task.id}')"
        ><i class="bi bi-trash3"></i></button>
      </div>
    </li>
  `;
}

/** Return the tasks visible under the current filter */
function filteredTasks() {
  if (filter === 'all') return tasks;
  return tasks.filter(t => t.status === filter);
}

/** Update stats counters */
function renderStats() {
  numTotal.textContent      = tasks.length;
  numInProgress.textContent = tasks.filter(t => t.status === STATUS.INPROGRESS).length;
  numDone.textContent       = tasks.filter(t => t.status === STATUS.DONE).length;
}

/** Show / hide the "Clear completed" button */
function renderFooter() {
  const hasDone = tasks.some(t => t.status === STATUS.DONE);
  footerActions.style.display = hasDone ? 'flex' : 'none';
}

/** Re-render the full task list */
function renderTasks() {
  const visible = filteredTasks();

  if (visible.length === 0) {
    taskList.innerHTML = '';
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');
    taskList.innerHTML = visible.map(buildTaskHTML).join('');
  }
}

/** Master render function */
function renderAll() {
  renderStats();
  renderTasks();
  renderFooter();
}

/* ── Event Handlers ────────────────────────────────────── */

/** Handle Add Task button click */
function handleAddTask() {
  const value = taskInput.value;
  const { valid, message } = validateInput(value);

  if (!valid) {
    showError(message);
    taskInput.focus();
    // Shake animation on the card
    const card = document.querySelector('.add-task-card');
    card.style.animation = 'none';
    requestAnimationFrame(() => {
      card.style.animation = 'shake .35s ease';
    });
    return;
  }

  showError('');
  addTask(value);
  taskInput.value = '';
  charCount.textContent = '0';
  charCounter.classList.remove('warn');
  taskInput.focus();
}

/** Live character counter */
function handleCharInput() {
  const len = taskInput.value.length;
  charCount.textContent = len;
  charCounter.classList.toggle('warn', len > 100);
  // Clear error once user starts correcting
  if (errorMsg.classList.contains('visible')) {
    const { valid } = validateInput(taskInput.value);
    if (valid) showError('');
  }
}

/** Filter tab click */
function handleFilterClick(e) {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  filterTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  tab.classList.add('active');
  tab.setAttribute('aria-selected', 'true');
  filter = tab.dataset.filter;
  renderTasks();
}

/* ── Keyboard shortcuts ────────────────────────────────── */
taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleAddTask();
  if (e.key === 'Escape') {
    taskInput.value = '';
    charCount.textContent = '0';
    charCounter.classList.remove('warn');
    showError('');
  }
});

/* ── Shake Keyframe (injected once) ────────────────────── */
(function injectShake() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%,100%{ transform:translateX(0) }
      20%    { transform:translateX(-6px) }
      40%    { transform:translateX(6px) }
      60%    { transform:translateX(-4px) }
      80%    { transform:translateX(4px) }
    }
  `;
  document.head.appendChild(style);
})();

/* ── Timestamp Refresh (every 60s) ─────────────────────── */
setInterval(() => {
  document.querySelectorAll('.task-timestamp').forEach(el => {
    const li = el.closest('.task-item');
    if (!li) return;
    const task = tasks.find(t => t.id === li.dataset.id);
    if (task) el.textContent = formatTime(task.createdAt);
  });
}, 60000);

/* ── Wire Up Events ────────────────────────────────────── */
addTaskBtn.addEventListener('click', handleAddTask);
taskInput.addEventListener('input', handleCharInput);
clearDoneBtn.addEventListener('click', clearDone);
document.querySelector('.filter-tabs').addEventListener('click', handleFilterClick);

/* ── Expose globals for inline onclick handlers ────────── */
window.cycleStatus = cycleStatus;
window.deleteTask  = deleteTask;

/* ── Init ───────────────────────────────────────────────── */
loadTasks();
renderAll();
