// ============================================================
//  DASHBOARD.JS — Main App Logic
// ============================================================

let currentUser = null;
let allNotes = [], allTasks = [], allEvents = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;

// ---- AUTH GUARD ----
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  currentUser = session.user;
  initApp();
})();

async function initApp() {
  // Set user info
  const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
  const initial = name.charAt(0).toUpperCase();
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-email').textContent = currentUser.email;

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning ☀️' : hour < 17 ? 'Good afternoon 🌤' : 'Good evening 🌙';
  document.getElementById('greeting').textContent = `${greeting}, ${name.split(' ')[0]}!`;

  // Today date
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Load data
  await Promise.all([loadNotes(), loadTasks(), loadEvents()]);
  renderDashboard();
  renderCalendar();

  // Nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(item.dataset.section);
      if (window.innerWidth <= 700) toggleSidebar();
    });
  });
}

function handleLogout() {
  supabase.auth.signOut().then(() => window.location.href = 'index.html');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

// ---- SECTION NAVIGATION ----
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelector(`[data-section="${name}"]`).classList.add('active');
  if (name === 'planner') renderCalendar();
}

// ---- TOAST ----
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ---- MODAL ----
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
});

// ==============================
//  NOTES
// ==============================

async function loadNotes() {
  const { data } = await supabase.from('notes').select('*')
    .eq('user_id', currentUser.id).order('created_at', { ascending: false });
  allNotes = data || [];
  renderNotes(allNotes);
  document.getElementById('stat-notes').textContent = allNotes.length;
}

function renderNotes(notes) {
  const grid = document.getElementById('notes-grid');
  if (!notes.length) {
    grid.innerHTML = '<div class="empty-state-full">No notes yet. Click "+ New Note" to start.</div>';
    return;
  }
  grid.innerHTML = notes.map(n => `
    <div class="note-card" onclick="editNote('${n.id}')">
      <div class="note-actions" onclick="event.stopPropagation()">
        <button class="note-action-btn" onclick="editNote('${n.id}')">✏️</button>
        <button class="note-action-btn delete" onclick="deleteNote('${n.id}')">🗑</button>
      </div>
      <div class="note-card-title">${esc(n.title)}</div>
      <div class="note-card-content">${esc(n.content || '')}</div>
      <div class="note-card-footer">
        <span class="note-tag">${n.category || 'general'}</span>
        <span class="note-date">${formatDate(n.created_at)}</span>
      </div>
    </div>
  `).join('');
}

function filterNotes(q) {
  const filtered = allNotes.filter(n =>
    n.title.toLowerCase().includes(q.toLowerCase()) ||
    (n.content || '').toLowerCase().includes(q.toLowerCase())
  );
  renderNotes(filtered);
}

function openNoteModal(note = null) {
  document.getElementById('note-id').value = note ? note.id : '';
  document.getElementById('note-title').value = note ? note.title : '';
  document.getElementById('note-content').value = note ? (note.content || '') : '';
  document.getElementById('note-category').value = note ? (note.category || 'general') : 'general';
  document.getElementById('note-modal-title').textContent = note ? 'Edit Note' : 'New Note';
  openModal('note-modal');
  setTimeout(() => document.getElementById('note-title').focus(), 100);
}

function editNote(id) {
  const note = allNotes.find(n => n.id === id);
  if (note) openNoteModal(note);
}

async function saveNote() {
  const id = document.getElementById('note-id').value;
  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-content').value.trim();
  const category = document.getElementById('note-category').value;

  if (!title) { showToast('Please enter a title'); return; }

  const payload = { title, content, category, user_id: currentUser.id, updated_at: new Date().toISOString() };

  if (id) {
    await supabase.from('notes').update(payload).eq('id', id);
    showToast('Note updated ✓');
  } else {
    payload.created_at = new Date().toISOString();
    await supabase.from('notes').insert(payload);
    showToast('Note saved ✓');
  }

  closeModal('note-modal');
  await loadNotes();
  renderDashboard();
}

async function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  await supabase.from('notes').delete().eq('id', id);
  showToast('Note deleted');
  await loadNotes();
  renderDashboard();
}

// ==============================
//  TASKS
// ==============================

async function loadTasks() {
  const { data } = await supabase.from('tasks').select('*')
    .eq('user_id', currentUser.id).order('created_at', { ascending: false });
  allTasks = data || [];
  renderTasks(allTasks);
  const pending = allTasks.filter(t => !t.done).length;
  document.getElementById('stat-tasks').textContent = allTasks.length;
  document.getElementById('stat-pending').textContent = pending;
}

function renderTasks(tasks) {
  const list = document.getElementById('tasks-list');
  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state-full">No tasks. Click "+ New Task" to add one.</div>';
    return;
  }
  list.innerHTML = tasks.map(t => `
    <div class="task-item ${t.done ? 'done' : ''}" id="task-item-${t.id}">
      <div class="task-check" onclick="toggleTask('${t.id}', ${t.done})"></div>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">${t.due_date ? '📅 ' + t.due_date : ''} ${t.notes ? '· ' + esc(t.notes.substring(0, 40)) : ''}</div>
      </div>
      <span class="priority-badge ${t.priority}">${t.priority}</span>
      <button class="task-edit" onclick="editTask('${t.id}')">✏️</button>
      <button class="task-delete" onclick="deleteTask('${t.id}')">✕</button>
    </div>
  `).join('');
}

function filterTasks(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  let filtered = allTasks;
  if (type === 'pending') filtered = allTasks.filter(t => !t.done);
  else if (type === 'completed') filtered = allTasks.filter(t => t.done);
  else if (type === 'high') filtered = allTasks.filter(t => t.priority === 'high');
  renderTasks(filtered);
}

function openTaskModal(task = null) {
  document.getElementById('task-id').value = task ? task.id : '';
  document.getElementById('task-title').value = task ? task.title : '';
  document.getElementById('task-priority').value = task ? task.priority : 'medium';
  document.getElementById('task-due').value = task ? (task.due_date || '') : '';
  document.getElementById('task-notes').value = task ? (task.notes || '') : '';
  document.getElementById('task-modal-title').textContent = task ? 'Edit Task' : 'New Task';
  openModal('task-modal');
  setTimeout(() => document.getElementById('task-title').focus(), 100);
}

function editTask(id) {
  const task = allTasks.find(t => t.id === id);
  if (task) openTaskModal(task);
}

async function saveTask() {
  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value.trim();
  const priority = document.getElementById('task-priority').value;
  const due_date = document.getElementById('task-due').value;
  const notes = document.getElementById('task-notes').value.trim();

  if (!title) { showToast('Please enter a task title'); return; }

  const payload = { title, priority, due_date: due_date || null, notes: notes || null, user_id: currentUser.id };

  if (id) {
    await supabase.from('tasks').update(payload).eq('id', id);
    showToast('Task updated ✓');
  } else {
    payload.done = false;
    payload.created_at = new Date().toISOString();
    await supabase.from('tasks').insert(payload);
    showToast('Task added ✓');
  }

  closeModal('task-modal');
  await loadTasks();
  renderDashboard();
}

async function toggleTask(id, currentDone) {
  await supabase.from('tasks').update({ done: !currentDone }).eq('id', id);
  await loadTasks();
  renderDashboard();
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  await supabase.from('tasks').delete().eq('id', id);
  showToast('Task deleted');
  await loadTasks();
  renderDashboard();
}

// ==============================
//  EVENTS / PLANNER
// ==============================

async function loadEvents() {
  const { data } = await supabase.from('events').select('*')
    .eq('user_id', currentUser.id).order('event_date', { ascending: true });
  allEvents = data || [];
  document.getElementById('stat-events').textContent = allEvents.length;
}

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  const grid = document.getElementById('cal-grid');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  label.textContent = `${months[currentMonth]} ${currentYear}`;

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevDays = new Date(currentYear, currentMonth, 0).getDate();

  let html = days.map(d => `<div class="cal-day-label">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    const d = prevDays - firstDay + 1 + i;
    html += `<div class="cal-day other-month">${d}</div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
    const hasEv = allEvents.some(e => e.event_date === dateStr);
    const isSel = selectedDate === dateStr;
    html += `<div class="cal-day ${isToday?'today':''} ${hasEv?'has-events':''} ${isSel?'selected':''}" onclick="selectDate('${dateStr}')">${d}</div>`;
  }

  const remaining = 42 - firstDay - daysInMonth;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month">${i}</div>`;
  }

  grid.innerHTML = html;
  if (selectedDate) renderEventsForDate(selectedDate);
}

function selectDate(dateStr) {
  selectedDate = dateStr;
  renderCalendar();
  renderEventsForDate(dateStr);
}

function renderEventsForDate(dateStr) {
  const label = document.getElementById('events-today-label');
  const list = document.getElementById('events-list');
  const evs = allEvents.filter(e => e.event_date === dateStr);
  label.textContent = `Events for ${dateStr}`;
  if (!evs.length) {
    list.innerHTML = '<div class="empty-state">No events for this day.</div>';
    return;
  }
  list.innerHTML = evs.map(e => `
    <div class="event-item">
      <div>
        <div class="event-title">${esc(e.title)}</div>
        <div class="event-meta">${e.event_time ? '⏰ ' + e.event_time : ''} ${e.description ? '· ' + esc(e.description.substring(0,50)) : ''}</div>
      </div>
      <button class="event-delete" onclick="deleteEvent('${e.id}')">✕</button>
    </div>
  `).join('');
}

function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}

function openEventModal() {
  document.getElementById('event-id').value = '';
  document.getElementById('event-title').value = '';
  document.getElementById('event-date').value = selectedDate || '';
  document.getElementById('event-time').value = '';
  document.getElementById('event-desc').value = '';
  openModal('event-modal');
  setTimeout(() => document.getElementById('event-title').focus(), 100);
}

async function saveEvent() {
  const title = document.getElementById('event-title').value.trim();
  const event_date = document.getElementById('event-date').value;
  const event_time = document.getElementById('event-time').value;
  const description = document.getElementById('event-desc').value.trim();

  if (!title || !event_date) { showToast('Title and date are required'); return; }

  await supabase.from('events').insert({
    title, event_date, event_time: event_time || null,
    description: description || null,
    user_id: currentUser.id,
    created_at: new Date().toISOString()
  });

  showToast('Event saved ✓');
  closeModal('event-modal');
  await loadEvents();
  document.getElementById('stat-events').textContent = allEvents.length;
  renderCalendar();
}

async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  await supabase.from('events').delete().eq('id', id);
  showToast('Event deleted');
  await loadEvents();
  renderCalendar();
}

// ==============================
//  DASHBOARD RENDER
// ==============================

function renderDashboard() {
  // Recent notes
  const notesList = document.getElementById('dash-notes-list');
  const recent = allNotes.slice(0, 4);
  if (!recent.length) {
    notesList.innerHTML = '<div class="empty-state">No notes yet.</div>';
  } else {
    notesList.innerHTML = recent.map(n => `
      <div class="dash-note-item" onclick="showSection('notes')">
        <div class="dash-item-title">${esc(n.title)}</div>
        <div class="dash-item-meta">${n.category} · ${formatDate(n.created_at)}</div>
      </div>
    `).join('');
  }

  // Upcoming tasks
  const tasksList = document.getElementById('dash-tasks-list');
  const upcoming = allTasks.filter(t => !t.done).slice(0, 4);
  if (!upcoming.length) {
    tasksList.innerHTML = '<div class="empty-state">No pending tasks.</div>';
  } else {
    tasksList.innerHTML = upcoming.map(t => `
      <div class="dash-task-item" onclick="showSection('tasks')">
        <div class="dash-item-title">${esc(t.title)}</div>
        <div class="dash-item-meta">${t.priority} priority ${t.due_date ? '· Due ' + t.due_date : ''}</div>
      </div>
    `).join('');
  }
}

// ==============================
//  HELPERS
// ==============================

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
