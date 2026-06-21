/* ===========================================================
   DAILY LIST — app logic
   A state-driven to-do app:
     1. `tasks` array is the single source of truth.
     2. Every action (add/edit/delete/toggle) updates the array.
     3. After every update we save to localStorage and re-render.
   No task is ever hardcoded into the HTML — everything in the
   list is built dynamically from the `tasks` array.
   =========================================================== */

(function () {
  'use strict';

  /* ---------- Constants ---------- */
  const STORAGE_KEY = 'daily-list.tasks';

  /* ---------- DOM references ---------- */
  const form = document.getElementById('task-form');
  const input = document.getElementById('task-input');
  const list = document.getElementById('task-list');
  const counter = document.getElementById('task-counter');
  const filtersWrap = document.getElementById('filters');
  const clearCompletedBtn = document.getElementById('clear-completed');
  const emptyState = document.getElementById('empty-state');
  const emptyStateText = document.getElementById('empty-state-text');
  const editTemplate = document.getElementById('edit-template');

  /* ---------- App state ----------
     tasks: Array<{ id: string, text: string, completed: boolean }>
     currentFilter: 'all' | 'active' | 'completed'
  -------------------------------- */
  let tasks = [];
  let currentFilter = 'all';

  /* =========================================================
     STORAGE — load and save the tasks array to localStorage
     ========================================================= */

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      tasks = raw ? JSON.parse(raw) : [];
    } catch (err) {
      // If localStorage is corrupted or unavailable, fail safe with an empty list
      console.error('Could not load tasks from localStorage:', err);
      tasks = [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.error('Could not save tasks to localStorage:', err);
    }
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  // Generate a reasonably unique id without needing any library
  function generateId() {
    return 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // Return only the tasks that should be visible for the current filter
  function getVisibleTasks() {
    if (currentFilter === 'active') {
      return tasks.filter((task) => !task.completed);
    }
    if (currentFilter === 'completed') {
      return tasks.filter((task) => task.completed);
    }
    return tasks;
  }

  // Escape any text that gets inserted as HTML, so task text can never break the page
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* =========================================================
     RENDER — rebuild the DOM from the current state
     This is the only place that writes task markup to the page.
     ========================================================= */

  function render() {
    const visibleTasks = getVisibleTasks();

    // Build all task rows as a single HTML string, then inject once.
    // This keeps DOM writes minimal and avoids hardcoding any task in the HTML file.
    list.innerHTML = visibleTasks
      .map((task) => buildTaskRowHtml(task))
      .join('');

    updateEmptyState(visibleTasks.length);
    updateCounter();
    updateClearCompletedState();
  }

  function buildTaskRowHtml(task) {
    const completedClass = task.completed ? ' is-completed' : '';
    const safeText = escapeHtml(task.text);

    return `
      <li class="task-item${completedClass}" data-id="${task.id}">
        <button
          type="button"
          class="task-item__check"
          data-action="toggle"
          role="checkbox"
          aria-checked="${task.completed}"
          aria-label="Mark '${safeText}' as ${task.completed ? 'active' : 'completed'}"
        >
          <svg class="task-item__check-icon" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.2 11.5L13 4.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <span class="task-item__text" data-action="start-edit" tabindex="0">${safeText}</span>

        <div class="task-item__actions">
          <button type="button" class="task-item__action-btn" data-action="start-edit" aria-label="Edit task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </button>
          <button type="button" class="task-item__action-btn is-delete" data-action="delete" aria-label="Delete task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </li>
    `;
  }

  function updateEmptyState(visibleCount) {
    if (visibleCount > 0) {
      emptyState.classList.remove('is-visible');
      return;
    }

    // Different empty-state copy depending on *why* the list looks empty
    if (tasks.length === 0) {
      emptyStateText.textContent = 'Nothing on the list yet. Add your first task above.';
    } else if (currentFilter === 'active') {
      emptyStateText.textContent = 'Nothing active — everything is done. Nice work.';
    } else if (currentFilter === 'completed') {
      emptyStateText.textContent = 'No completed tasks yet.';
    }

    emptyState.classList.add('is-visible');
  }

  function updateCounter() {
    const activeCount = tasks.filter((task) => !task.completed).length;
    const label = activeCount === 1 ? 'task left' : 'tasks left';
    counter.textContent = `${activeCount} ${label}`;
  }

  function updateClearCompletedState() {
    const hasCompleted = tasks.some((task) => task.completed);
    clearCompletedBtn.disabled = !hasCompleted;
  }

  /* =========================================================
     STATE MUTATIONS (the "C", "U", "D" of CRUD)
     Every mutation funnels through here, then saves + re-renders.
     ========================================================= */

  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return; // ignore empty/whitespace-only input

    tasks.unshift({
      id: generateId(),
      text: trimmed,
      completed: false,
    });

    commit();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    commit();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    commit();
  }

  function editTaskText(id, newText) {
    const trimmed = newText.trim();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (!trimmed) {
      // Editing down to an empty string deletes the task, same as most to-do apps
      deleteTask(id);
      return;
    }

    task.text = trimmed;
    commit();
  }

  function clearCompleted() {
    tasks = tasks.filter((t) => !t.completed);
    commit();
  }

  // Save to localStorage and re-render — call this after any state change
  function commit() {
    saveTasks();
    render();
  }

  /* =========================================================
     INLINE EDIT — swap a task's text span for an input field
     ========================================================= */

  function startEdit(taskId) {
    const row = list.querySelector(`.task-item[data-id="${taskId}"]`);
    if (!row) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const textSpan = row.querySelector('.task-item__text');
    if (!textSpan) return;

    // Clone the <input> from the <template> in index.html
    const editInput = editTemplate.content.firstElementChild.cloneNode(true);
    editInput.value = task.text;

    textSpan.replaceWith(editInput);
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);

    let finished = false; // guards against double-firing (blur + Enter)

    const finishEdit = (commitChange) => {
      if (finished) return;
      finished = true;

      if (commitChange) {
        editTaskText(taskId, editInput.value);
      } else {
        render(); // cancel: just redraw from existing state
      }
    };

    editInput.addEventListener('blur', () => finishEdit(true));

    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        editInput.blur(); // triggers finishEdit(true) above
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(false);
      }
    });
  }

  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  // Add task on form submit (covers both button click and pressing Enter)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    addTask(input.value);
    input.value = '';
    input.focus();
  });

  // Event delegation: ONE listener on the list handles toggle/edit/delete
  // for every task row, including rows added after page load.
  list.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const row = e.target.closest('.task-item');
    if (!row) return;

    const taskId = row.dataset.id;
    const action = actionEl.dataset.action;

    if (action === 'toggle') {
      toggleTask(taskId);
    } else if (action === 'delete') {
      deleteTask(taskId);
    } else if (action === 'start-edit') {
      startEdit(taskId);
    }
  });

  // Keyboard support: Enter/Space on a focused task label also starts editing
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest('[data-action="start-edit"]');
    if (!target) return;

    e.preventDefault();
    const row = e.target.closest('.task-item');
    if (row) startEdit(row.dataset.id);
  });

  // Filter buttons (event delegation on the wrapping group)
  filtersWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    currentFilter = btn.dataset.filter;

    // Update active styling + aria-selected on all filter buttons
    filtersWrap.querySelectorAll('.filter-btn').forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle('is-active', isActive);
      b.setAttribute('aria-selected', String(isActive));
    });

    render();
  });

  // Clear completed
  clearCompletedBtn.addEventListener('click', clearCompleted);

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    loadTasks();
    render();
  }

  init();
})();
