// ============================================================
//  ADMIN.JS — Admin Panel Logic
// ============================================================

let allUsers = [];
let currentResetUserId = null;
let currentDataTab = 'notes';

// Simple admin login (credentials from config.js)
function adminLogin() {
  const u = document.getElementById('admin-user').value.trim();
  const p = document.getElementById('admin-pass').value;
  const err = document.getElementById('admin-err');

  if (u === ADMIN_USERNAME && p === ADMIN_PASSWORD) {
    sessionStorage.setItem('planr_admin', 'true');
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    loadAdminData();
  } else {
    err.classList.add('show');
    setTimeout(() => err.classList.remove('show'), 3000);
  }
}

function adminLogout() {
  sessionStorage.removeItem('planr_admin');
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('admin-login').style.display = 'flex';
  document.getElementById('admin-user').value = '';
  document.getElementById('admin-pass').value = '';
}

// Check if already authenticated
if (sessionStorage.getItem('planr_admin') === 'true') {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  loadAdminData();
}

// Enter key for login
document.getElementById('admin-pass')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') adminLogin();
});

// ---- LOAD ALL DATA ----
async function loadAdminData() {
  await Promise.all([loadUsers(), loadAllNotes(), loadAllTasks(), loadAllEvents()]);
}

async function loadUsers() {
  // Fetch profiles table which has all users
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading users:', error);
    showAdminToast('Error: ' + error.message);
    return;
  }

  allUsers = profiles || [];
  document.getElementById('stat-users').textContent = allUsers.length;
  renderUsersTable(allUsers);
}

async function loadAllNotes() {
  const { data, count } = await supabase.from('notes').select('*', { count: 'exact' });
  document.getElementById('stat-all-notes').textContent = count || 0;
  window._allNotes = data || [];
  if (currentDataTab === 'notes') renderDataTab('notes', data || []);
}

async function loadAllTasks() {
  const { data, count } = await supabase.from('tasks').select('*', { count: 'exact' });
  document.getElementById('stat-all-tasks').textContent = count || 0;
  window._allTasks = data || [];
  if (currentDataTab === 'tasks') renderDataTab('tasks', data || []);
}

async function loadAllEvents() {
  const { data, count } = await supabase.from('events').select('*', { count: 'exact' });
  document.getElementById('stat-all-events').textContent = count || 0;
  window._allEvents = data || [];
}

// ---- USERS TABLE ----
function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const initial = (u.full_name || u.email || '?').charAt(0).toUpperCase();
    const created = u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
    const lastLogin = u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-row-avatar">${initial}</div>
            <div>
              <div style="font-weight:500">${esc(u.full_name || 'Unknown')}</div>
              <div style="font-size:11px;color:var(--muted)">ID: ${u.id.substring(0,8)}...</div>
            </div>
          </div>
        </td>
        <td style="color:var(--muted)">${esc(u.email)}</td>
        <td style="color:var(--muted)">${created}</td>
        <td style="color:var(--muted)">${lastLogin}</td>
        <td>
          <div class="action-btns">
            <button class="btn-sm" onclick="toggleUserDetail('${u.id}')">Details</button>
            <button class="btn-sm primary" onclick="openResetModal('${u.id}', '${esc(u.email)}')">Reset PW</button>
            <button class="btn-sm danger" onclick="deleteUserData('${u.id}')">Delete Data</button>
          </div>
        </td>
      </tr>
      <tr class="detail-row" id="detail-${u.id}">
        <td colspan="5" class="detail-cell">
          <div class="detail-grid">
            <div class="detail-item">
              <label>Full Name</label>
              <span>${esc(u.full_name || '—')}</span>
            </div>
            <div class="detail-item">
              <label>Email</label>
              <span>${esc(u.email)}</span>
            </div>
            <div class="detail-item">
              <label>User ID</label>
              <span style="font-size:11px;word-break:break-all">${u.id}</span>
            </div>
            <div class="detail-item">
              <label>Account Created</label>
              <span>${created}</span>
            </div>
            <div class="detail-item">
              <label>Notes Count</label>
              <span id="user-notes-${u.id}">—</span>
            </div>
            <div class="detail-item">
              <label>Tasks Count</label>
              <span id="user-tasks-${u.id}">—</span>
            </div>
          </div>
          <div id="user-data-loaded-${u.id}"></div>
        </td>
      </tr>
    `;
  }).join('');
}

function searchUsers(q) {
  const filtered = allUsers.filter(u =>
    (u.email || '').toLowerCase().includes(q.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(q.toLowerCase())
  );
  renderUsersTable(filtered);
}

async function toggleUserDetail(userId) {
  const row = document.getElementById(`detail-${userId}`);
  const isOpen = row.classList.contains('open');

  // Close all
  document.querySelectorAll('.detail-row').forEach(r => r.classList.remove('open'));

  if (!isOpen) {
    row.classList.add('open');
    // Load user-specific counts
    const [{ count: nc }, { count: tc }] = await Promise.all([
      supabase.from('notes').select('*', { count:'exact', head:true }).eq('user_id', userId),
      supabase.from('tasks').select('*', { count:'exact', head:true }).eq('user_id', userId)
    ]);
    document.getElementById(`user-notes-${userId}`).textContent = nc ?? '0';
    document.getElementById(`user-tasks-${userId}`).textContent = tc ?? '0';
  }
}

// ---- PASSWORD RESET ----
function openResetModal(userId, email) {
  currentResetUserId = userId;
  document.getElementById('pw-user-email').textContent = email;
  document.getElementById('new-password').value = '';
  document.getElementById('pw-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-password').focus(), 100);
}

function closeModal() {
  document.getElementById('pw-modal').classList.remove('open');
  currentResetUserId = null;
}

async function confirmReset() {
  const newPw = document.getElementById('new-password').value.trim();
  if (!newPw || newPw.length < 6) {
    showAdminToast('Password must be at least 6 characters');
    return;
  }

  // Use Supabase admin API via service role
  // NOTE: This requires the service role key for admin user updates
  // For security, this is done via edge function or service role key
  // With anon key, this will only work if user is currently logged in (own account)
  // For full admin reset, deploy the edge function (see SETUP.md)
  
  const { error } = await supabase.auth.admin.updateUserById(currentResetUserId, {
    password: newPw
  });

  if (error) {
    // Fallback: show instructions
    showAdminToast(`To reset: Ask user to use password recovery, or use Supabase Dashboard → Auth → Users`);
  } else {
    showAdminToast('✓ Password reset successfully');
  }
  closeModal();
}

// ---- DELETE USER DATA ----
async function deleteUserData(userId) {
  const user = allUsers.find(u => u.id === userId);
  const name = user?.full_name || user?.email || userId;

  if (!confirm(`Delete ALL data (notes, tasks, events) for ${name}?\n\nThis cannot be undone.`)) return;

  await Promise.all([
    supabase.from('notes').delete().eq('user_id', userId),
    supabase.from('tasks').delete().eq('user_id', userId),
    supabase.from('events').delete().eq('user_id', userId)
  ]);

  showAdminToast(`✓ All data for ${name} deleted`);
  await loadAdminData();
}

// ---- DATA TABS ----
function showDataTab(tab, btn) {
  currentDataTab = tab;
  document.querySelectorAll('.data-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const data = tab === 'notes' ? window._allNotes : tab === 'tasks' ? window._allTasks : window._allEvents;
  renderDataTab(tab, data || []);
}

function renderDataTab(tab, data) {
  const thead = document.getElementById('data-thead');
  const tbody = document.getElementById('data-tbody');

  if (tab === 'notes') {
    thead.innerHTML = '<tr><th>Title</th><th>Category</th><th>User ID</th><th>Created</th><th>Action</th></tr>';
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">No notes</td></tr>'; return; }
    tbody.innerHTML = data.map(n => `
      <tr>
        <td style="font-weight:500">${esc(n.title)}</td>
        <td><span class="badge badge-blue">${n.category||'general'}</span></td>
        <td style="font-size:11px;color:var(--muted)">${n.user_id?.substring(0,12)}...</td>
        <td style="color:var(--muted)">${n.created_at ? new Date(n.created_at).toLocaleDateString() : '—'}</td>
        <td><button class="btn-sm danger" onclick="adminDeleteNote('${n.id}')">Delete</button></td>
      </tr>
    `).join('');
  } else if (tab === 'tasks') {
    thead.innerHTML = '<tr><th>Title</th><th>Priority</th><th>Done</th><th>User ID</th><th>Created</th><th>Action</th></tr>';
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">No tasks</td></tr>'; return; }
    tbody.innerHTML = data.map(t => `
      <tr>
        <td style="font-weight:500">${esc(t.title)}</td>
        <td><span class="badge ${t.priority==='high'?'badge-orange':t.priority==='medium'?'badge-blue':'badge-green'}">${t.priority}</span></td>
        <td>${t.done ? '✅' : '⬜'}</td>
        <td style="font-size:11px;color:var(--muted)">${t.user_id?.substring(0,12)}...</td>
        <td style="color:var(--muted)">${t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
        <td><button class="btn-sm danger" onclick="adminDeleteTask('${t.id}')">Delete</button></td>
      </tr>
    `).join('');
  } else {
    thead.innerHTML = '<tr><th>Title</th><th>Date</th><th>Time</th><th>User ID</th><th>Action</th></tr>';
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">No events</td></tr>'; return; }
    tbody.innerHTML = data.map(e => `
      <tr>
        <td style="font-weight:500">${esc(e.title)}</td>
        <td style="color:var(--muted)">${e.event_date||'—'}</td>
        <td style="color:var(--muted)">${e.event_time||'—'}</td>
        <td style="font-size:11px;color:var(--muted)">${e.user_id?.substring(0,12)}...</td>
        <td><button class="btn-sm danger" onclick="adminDeleteEvent('${e.id}')">Delete</button></td>
      </tr>
    `).join('');
  }
}

async function adminDeleteNote(id) {
  if (!confirm('Delete this note?')) return;
  await supabase.from('notes').delete().eq('id', id);
  showAdminToast('Note deleted');
  await loadAllNotes();
}
async function adminDeleteTask(id) {
  if (!confirm('Delete this task?')) return;
  await supabase.from('tasks').delete().eq('id', id);
  showAdminToast('Task deleted');
  await loadAllTasks();
}
async function adminDeleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  await supabase.from('events').delete().eq('id', id);
  showAdminToast('Event deleted');
  await loadAllEvents();
}

// ---- HELPERS ----
function showAdminToast(msg) {
  const t = document.getElementById('admin-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
