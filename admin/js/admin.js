// ============================================================
//  PLANR ADMIN — Full Control Center Logic
// ============================================================

var currentUserId = null;
var allUsers = [], allNotes = [], allTasks = [], allEvents = [];
var activityLog = [];
var sessionLog = [];
var broadcastList = [];
var adminPw = ADMIN_PASSWORD; // runtime-changeable

// ── SESSION STORAGE CHECK ──
if (sessionStorage.getItem('planr_admin_auth') === 'true') {
  bootAdmin();
}

document.getElementById('l-pass').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('l-user').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doLogin();
});

function doLogin() {
  var u = document.getElementById('l-user').value.trim();
  var p = document.getElementById('l-pass').value;
  var err = document.getElementById('l-err');

  if (u === ADMIN_USERNAME && p === adminPw) {
    sessionStorage.setItem('planr_admin_auth', 'true');
    err.classList.remove('show');
    bootAdmin();
  } else {
    err.classList.add('show');
    addLog('admin', '⚠ Failed admin login attempt', 'admin');
    setTimeout(function() { err.classList.remove('show'); }, 3000);
  }
}

function doLogout() {
  sessionStorage.removeItem('planr_admin_auth');
  document.getElementById('admin-shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('l-user').value = '';
  document.getElementById('l-pass').value = '';
}

function bootAdmin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-shell').style.display = 'block';
  startClock();
  loadAll();
  addLog('admin', '✓ Admin signed in', 'admin');
}

// ── CLOCK ──
function startClock() {
  function tick() {
    var now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', { hour12: false });
  }
  tick();
  setInterval(tick, 1000);
}

// ── NAVIGATION ──
function showSec(name, btn) {
  document.querySelectorAll('.admin-section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('sec-' + name).classList.add('active');
  if (btn) btn.classList.add('active');

  // Lazy load
  if (name === 'sessions') loadSessions();
  if (name === 'activity') loadActivity();
  if (name === 'notes') renderNotes(allNotes);
  if (name === 'tasks') renderTasks(allTasks);
  if (name === 'events') renderEvents(allEvents);
}

// ── LOAD ALL DATA ──
async function loadAll() {
  await Promise.all([loadUsers(), loadNotes(), loadTasks(), loadEvents(), loadSessions(), loadActivity()]);
  updateDashStats();
  renderDashRecent();
  renderDashActivity();
}

async function loadUsers() {
  var res = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  allUsers = res.data || [];
  document.getElementById('s-users').textContent = allUsers.length;
  renderUsers(allUsers);

  // New this week
  var weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  var newCount = allUsers.filter(function(u) { return new Date(u.created_at) > weekAgo; }).length;
  document.getElementById('s-new').textContent = newCount;
}

async function loadNotes() {
  var res = await supabase.from('notes').select('*').order('created_at', { ascending: false });
  allNotes = res.data || [];
  document.getElementById('s-notes').textContent = allNotes.length;
}

async function loadTasks() {
  var res = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
  allTasks = res.data || [];
  document.getElementById('s-tasks').textContent = allTasks.length;
}

async function loadEvents() {
  var res = await supabase.from('events').select('*').order('event_date', { ascending: false });
  allEvents = res.data || [];
  document.getElementById('s-events').textContent = allEvents.length;
}

async function loadSessions() {
  // Try to load from login_sessions table
  var res = await supabase.from('login_sessions').select('*').order('created_at', { ascending: false }).limit(100);
  sessionLog = res.data || [];
  renderSessions(sessionLog);
}

async function loadActivity() {
  var res = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(200);
  var dbLogs = res.data || [];
  // Merge with in-memory logs
  var combined = activityLog.concat(dbLogs.map(function(l) {
    return { type: l.type || 'action', msg: l.message, time: l.created_at };
  }));
  renderActivity(combined);
  document.getElementById('s-logs').textContent = combined.length;
}

// ── STATS ──
function updateDashStats() {
  document.getElementById('s-users').textContent = allUsers.length;
  document.getElementById('s-notes').textContent = allNotes.length;
  document.getElementById('s-tasks').textContent = allTasks.length;
  document.getElementById('s-events').textContent = allEvents.length;
}

// ── DASHBOARD ──
function renderDashRecent() {
  var tbody = document.getElementById('dash-recent');
  var recent = allUsers.slice(0, 6);
  if (!recent.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No users yet.</td></tr>'; return; }
  tbody.innerHTML = recent.map(function(u) {
    var init = (u.full_name || u.email || '?').charAt(0).toUpperCase();
    return '<tr>' +
      '<td><div class="u-cell"><div class="u-avatar">' + init + '</div><div><div class="u-name">' + esc(u.full_name || 'Unknown') + '</div></div></div></td>' +
      '<td class="mono text-muted">' + esc(u.email) + '</td>' +
      '<td class="mono text-muted">' + fmtDate(u.created_at) + '</td>' +
      '<td><button class="btn" onclick="openUserModal(\'' + u.id + '\')">Manage</button></td>' +
      '</tr>';
  }).join('');
}

function renderDashActivity() {
  var el = document.getElementById('dash-activity');
  var logs = activityLog.slice(0, 8);
  if (!logs.length) { el.innerHTML = '<div class="empty">No activity yet.</div>'; return; }
  el.innerHTML = logs.map(renderLogEntry).join('');
}

// ── USERS TABLE ──
function renderUsers(users) {
  var tbody = document.getElementById('users-tbody');
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No users found.</td></tr>'; return; }
  tbody.innerHTML = users.map(function(u) {
    var init = (u.full_name || u.email || '?').charAt(0).toUpperCase();
    var noteCount = allNotes.filter(function(n) { return n.user_id === u.id; }).length;
    var taskCount = allTasks.filter(function(t) { return t.user_id === u.id; }).length;
    var created = fmtDate(u.created_at);
    var lastLogin = u.last_sign_in ? fmtDate(u.last_sign_in) : '<span class="text-muted">Never</span>';
    return '<tr>' +
      '<td><div class="u-cell"><div class="u-avatar">' + init + '</div><div><div class="u-name">' + esc(u.full_name || 'Unknown') + '</div><div class="u-sub">' + u.id.substring(0,10) + '…</div></div></div></td>' +
      '<td class="mono" style="font-size:12px">' + esc(u.email) + '</td>' +
      '<td class="mono text-muted">' + created + '</td>' +
      '<td class="mono text-muted">' + lastLogin + '</td>' +
      '<td><span class="badge badge-blue">' + noteCount + '</span></td>' +
      '<td><span class="badge badge-green">' + taskCount + '</span></td>' +
      '<td><div class="btn-row"><button class="btn" onclick="openUserModal(\'' + u.id + '\')">⚙ Manage</button></div></td>' +
      '</tr>';
  }).join('');
}

function searchUsers(q) {
  var filtered = allUsers.filter(function(u) {
    return (u.email || '').toLowerCase().includes(q.toLowerCase()) ||
           (u.full_name || '').toLowerCase().includes(q.toLowerCase());
  });
  renderUsers(filtered);
}

// ── SESSIONS ──
function renderSessions(sessions) {
  var tbody = document.getElementById('sessions-tbody');
  if (!sessions.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No sessions recorded yet. Sessions are logged when users sign in (requires login_sessions table — see setup notes).</td></tr>';
    return;
  }
  tbody.innerHTML = sessions.map(function(s) {
    return '<tr>' +
      '<td class="mono" style="font-size:11px">' + (s.user_id ? s.user_id.substring(0,10) + '…' : '—') + '</td>' +
      '<td>' + esc(s.email || '—') + '</td>' +
      '<td class="text-muted" style="font-size:12px">' + esc(s.user_agent ? s.user_agent.substring(0,50) : '—') + '</td>' +
      '<td class="mono" style="font-size:11px">' + esc(s.ip_address || '—') + '</td>' +
      '<td class="mono text-muted">' + fmtDateFull(s.created_at) + '</td>' +
      '</tr>';
  }).join('');
}

// ── ACTIVITY ──
function addLog(type, msg, category) {
  var entry = { type: category || type, msg: msg, time: new Date().toISOString() };
  activityLog.unshift(entry);
  if (activityLog.length > 200) activityLog.pop();

  // Also save to Supabase admin_logs table
  supabase.from('admin_logs').insert({ type: category || type, message: msg, created_at: entry.time }).then(function() {});

  renderDashActivity();
}

function renderLogEntry(log) {
  var dotClass = log.type || 'action';
  return '<div class="act-entry"><div class="act-dot ' + dotClass + '"></div><span class="act-time">' + fmtDateFull(log.time) + '</span><span class="act-msg">' + esc(log.msg) + '</span></div>';
}

function renderActivity(logs) {
  var el = document.getElementById('full-activity');
  if (!logs || !logs.length) { el.innerHTML = '<div class="empty">No activity logged yet.</div>'; return; }
  el.innerHTML = logs.map(renderLogEntry).join('');
  document.getElementById('s-logs').textContent = logs.length;
}

function loadActivity() {
  supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(200).then(function(res) {
    var dbLogs = (res.data || []).map(function(l) {
      return { type: l.type || 'action', msg: l.message, time: l.created_at };
    });
    renderActivity(dbLogs);
  });
}

// ── NOTES ──
function renderNotes(notes) {
  var tbody = document.getElementById('notes-tbody');
  if (!notes.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No notes.</td></tr>'; return; }
  tbody.innerHTML = notes.map(function(n) {
    var user = allUsers.find(function(u) { return u.id === n.user_id; });
    var uname = user ? (user.full_name || user.email) : n.user_id.substring(0,10) + '…';
    return '<tr>' +
      '<td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(n.title) + '</td>' +
      '<td><span class="badge badge-blue">' + (n.category || 'general') + '</span></td>' +
      '<td class="text-muted" style="font-size:12px">' + esc(uname) + '</td>' +
      '<td class="mono text-muted">' + fmtDate(n.created_at) + '</td>' +
      '<td><button class="btn text-red" style="border-color:rgba(255,51,85,0.3)" onclick="delNote(\'' + n.id + '\')">Delete</button></td>' +
      '</tr>';
  }).join('');
}

function searchNotes(q) {
  var filtered = allNotes.filter(function(n) {
    return n.title.toLowerCase().includes(q.toLowerCase()) || (n.content || '').toLowerCase().includes(q.toLowerCase());
  });
  renderNotes(filtered);
}

async function delNote(id) {
  if (!confirm('Delete this note?')) return;
  await supabase.from('notes').delete().eq('id', id);
  addLog('action', '🗑 Admin deleted note: ' + id.substring(0,8), 'action');
  toast('Note deleted', 'success');
  await loadNotes();
  renderNotes(allNotes);
}

// ── TASKS ──
function renderTasks(tasks) {
  var tbody = document.getElementById('tasks-tbody');
  if (!tasks.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No tasks.</td></tr>'; return; }
  tbody.innerHTML = tasks.map(function(t) {
    var user = allUsers.find(function(u) { return u.id === t.user_id; });
    var uname = user ? (user.full_name || user.email) : t.user_id.substring(0,10) + '…';
    var priClass = t.priority === 'high' ? 'badge-red' : t.priority === 'medium' ? 'badge-amber' : 'badge-green';
    return '<tr>' +
      '<td style="font-weight:500">' + esc(t.title) + '</td>' +
      '<td><span class="badge ' + priClass + '">' + t.priority + '</span></td>' +
      '<td>' + (t.done ? '<span class="badge badge-green">Done</span>' : '<span class="badge">Pending</span>') + '</td>' +
      '<td class="text-muted" style="font-size:12px">' + esc(uname) + '</td>' +
      '<td class="mono text-muted">' + (t.due_date || '—') + '</td>' +
      '<td><button class="btn text-red" style="border-color:rgba(255,51,85,0.3)" onclick="delTask(\'' + t.id + '\')">Delete</button></td>' +
      '</tr>';
  }).join('');
}

async function delTask(id) {
  if (!confirm('Delete this task?')) return;
  await supabase.from('tasks').delete().eq('id', id);
  addLog('action', '🗑 Admin deleted task: ' + id.substring(0,8), 'action');
  toast('Task deleted', 'success');
  await loadTasks();
  renderTasks(allTasks);
}

// ── EVENTS ──
function renderEvents(events) {
  var tbody = document.getElementById('events-tbody');
  if (!events.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No events.</td></tr>'; return; }
  tbody.innerHTML = events.map(function(e) {
    var user = allUsers.find(function(u) { return u.id === e.user_id; });
    var uname = user ? (user.full_name || user.email) : e.user_id.substring(0,10) + '…';
    return '<tr>' +
      '<td style="font-weight:500">' + esc(e.title) + '</td>' +
      '<td class="mono text-muted">' + (e.event_date || '—') + '</td>' +
      '<td class="mono text-muted">' + (e.event_time || '—') + '</td>' +
      '<td class="text-muted" style="font-size:12px">' + esc(uname) + '</td>' +
      '<td><button class="btn text-red" style="border-color:rgba(255,51,85,0.3)" onclick="delEvent(\'' + e.id + '\')">Delete</button></td>' +
      '</tr>';
  }).join('');
}

async function delEvent(id) {
  if (!confirm('Delete this event?')) return;
  await supabase.from('events').delete().eq('id', id);
  addLog('action', '🗑 Admin deleted event: ' + id.substring(0,8), 'action');
  toast('Event deleted', 'success');
  await loadEvents();
  renderEvents(allEvents);
}

// ── USER MODAL ──
function openUserModal(userId) {
  currentUserId = userId;
  var user = allUsers.find(function(u) { return u.id === userId; });
  if (!user) return;

  document.getElementById('m-uname').textContent = user.full_name || 'Unknown User';
  document.getElementById('m-uemail').textContent = user.email;

  // Pre-fill action fields
  document.getElementById('a-email').value = user.email || '';
  document.getElementById('a-name').value = user.full_name || '';
  document.getElementById('a-pw').value = '';

  // Info tab
  var noteCount = allNotes.filter(function(n) { return n.user_id === userId; }).length;
  var taskCount = allTasks.filter(function(t) { return t.user_id === userId; }).length;
  var eventCount = allEvents.filter(function(e) { return e.user_id === userId; }).length;
  var doneCount = allTasks.filter(function(t) { return t.user_id === userId && t.done; }).length;

  document.getElementById('m-info').innerHTML =
    infoTile('Full Name', user.full_name || '—') +
    infoTile('Email', user.email) +
    infoTile('User ID', '<span style="font-family:var(--mono);font-size:10px">' + user.id + '</span>') +
    infoTile('Account Created', fmtDateFull(user.created_at)) +
    infoTile('Last Sign In', user.last_sign_in ? fmtDateFull(user.last_sign_in) : 'Never') +
    infoTile('Notes', noteCount) +
    infoTile('Tasks', taskCount + ' (' + doneCount + ' done)') +
    infoTile('Events', eventCount);

  // Load data tab
  loadUserData(userId);
  loadUserSessions(userId);

  // Switch to info tab
  switchDTab('info', document.querySelector('.dtab'));

  document.getElementById('user-modal').classList.add('open');
  addLog('action', '👁 Admin viewed user: ' + (user.full_name || user.email), 'action');
}

function infoTile(label, value) {
  return '<div class="info-tile"><label>' + label + '</label><span>' + value + '</span></div>';
}

async function loadUserData(userId) {
  var el = document.getElementById('m-data');
  var [notesRes, tasksRes, eventsRes] = await Promise.all([
    supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('events').select('*').eq('user_id', userId).order('event_date', { ascending: false })
  ]);
  var notes = notesRes.data || [], tasks = tasksRes.data || [], events = eventsRes.data || [];

  var html = '<div style="margin-bottom:16px"><strong style="font-family:var(--mono);font-size:11px;color:var(--muted)">NOTES (' + notes.length + ')</strong>';
  if (!notes.length) html += '<div class="empty" style="padding:12px 0">No notes</div>';
  else html += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">' + notes.map(function(n) {
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px"><strong>' + esc(n.title) + '</strong> <span class="badge badge-blue">' + (n.category||'general') + '</span><div class="text-muted" style="margin-top:3px">' + fmtDate(n.created_at) + '</div></div>';
  }).join('') + '</div>';
  html += '</div>';

  html += '<div style="margin-bottom:16px"><strong style="font-family:var(--mono);font-size:11px;color:var(--muted)">TASKS (' + tasks.length + ')</strong>';
  if (!tasks.length) html += '<div class="empty" style="padding:12px 0">No tasks</div>';
  else html += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">' + tasks.map(function(t) {
    var priClass = t.priority === 'high' ? 'badge-red' : t.priority === 'medium' ? 'badge-amber' : 'badge-green';
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;display:flex;justify-content:space-between;align-items:center"><span>' + (t.done ? '✅ ' : '⬜ ') + esc(t.title) + '</span><span class="badge ' + priClass + '">' + t.priority + '</span></div>';
  }).join('') + '</div>';
  html += '</div>';

  html += '<div><strong style="font-family:var(--mono);font-size:11px;color:var(--muted)">EVENTS (' + events.length + ')</strong>';
  if (!events.length) html += '<div class="empty" style="padding:12px 0">No events</div>';
  else html += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">' + events.map(function(e) {
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px"><strong>' + esc(e.title) + '</strong><div class="text-muted">' + (e.event_date || '') + (e.event_time ? ' at ' + e.event_time : '') + '</div></div>';
  }).join('') + '</div>';
  html += '</div>';

  el.innerHTML = html;
}

async function loadUserSessions(userId) {
  var el = document.getElementById('m-sessions');
  var res = await supabase.from('login_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  var sessions = res.data || [];

  if (!sessions.length) {
    el.innerHTML = '<div class="empty">No sessions recorded for this user.<br><small style="color:var(--muted)">Requires login_sessions table (see setup notes).</small></div>';
    return;
  }

  el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead><tr><th style="text-align:left;padding:8px;color:var(--muted);font-family:var(--mono);font-size:10px;border-bottom:1px solid var(--border)">Time</th><th style="text-align:left;padding:8px;color:var(--muted);font-family:var(--mono);font-size:10px;border-bottom:1px solid var(--border)">IP</th><th style="text-align:left;padding:8px;color:var(--muted);font-family:var(--mono);font-size:10px;border-bottom:1px solid var(--border)">Browser</th></tr></thead>' +
    '<tbody>' + sessions.map(function(s) {
      return '<tr><td style="padding:8px;border-bottom:1px solid var(--border);font-family:var(--mono)">' + fmtDateFull(s.created_at) + '</td><td style="padding:8px;border-bottom:1px solid var(--border);font-family:var(--mono)">' + (s.ip_address || '—') + '</td><td style="padding:8px;border-bottom:1px solid var(--border);color:var(--muted)">' + esc((s.user_agent || '—').substring(0,60)) + '</td></tr>';
    }).join('') + '</tbody></table>';
}

// ── USER ACTIONS ──
async function doResetPw() {
  var pw = document.getElementById('a-pw').value.trim();
  if (!pw || pw.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }

  var user = allUsers.find(function(u) { return u.id === currentUserId; });

  // Since anon key can't update other users' passwords,
  // we update the profiles table with a reset flag and show instructions
  await supabase.from('profiles').update({ password_reset_requested: pw, reset_at: new Date().toISOString() }).eq('id', currentUserId);

  addLog('action', '🔑 Admin set password reset for: ' + (user ? user.email : currentUserId), 'action');
  toast('Password reset saved. Go to Supabase Dashboard → Auth → Users → find this user → Reset password to apply it directly.', 'info');

  // Also try Supabase dashboard link
  setTimeout(function() {
    toast('Tip: supabase.com → your project → Authentication → Users → find user → click ⋮ → Send recovery email', 'info');
  }, 2000);
}

async function doChangeEmail() {
  var email = document.getElementById('a-email').value.trim();
  if (!email || !email.includes('@')) { toast('Enter a valid email', 'error'); return; }

  var user = allUsers.find(function(u) { return u.id === currentUserId; });
  var oldEmail = user ? user.email : '';

  // Update in profiles table
  await supabase.from('profiles').update({ email: email }).eq('id', currentUserId);

  addLog('action', '✉️ Admin changed email: ' + oldEmail + ' → ' + email, 'action');
  toast('Email updated in profiles. User must also update via Supabase Auth (Dashboard → Auth → Users).', 'info');
  await loadUsers();
}

async function doChangeName() {
  var name = document.getElementById('a-name').value.trim();
  if (!name) { toast('Enter a name', 'error'); return; }

  var user = allUsers.find(function(u) { return u.id === currentUserId; });
  await supabase.from('profiles').update({ full_name: name }).eq('id', currentUserId);

  addLog('action', '👤 Admin renamed user: ' + (user ? user.email : currentUserId) + ' → ' + name, 'action');
  toast('Name updated ✓', 'success');
  await loadUsers();
}

async function doSendRecovery() {
  var user = allUsers.find(function(u) { return u.id === currentUserId; });
  if (!user) return;

  var res = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: window.location.origin.replace('/admin','') + '/noteflow/'
  });

  if (res.error) {
    toast('Error: ' + res.error.message, 'error');
  } else {
    addLog('action', '📧 Recovery email sent to: ' + user.email, 'action');
    toast('Recovery email sent to ' + user.email + ' ✓', 'success');
  }
}

async function doDeleteContent() {
  var user = allUsers.find(function(u) { return u.id === currentUserId; });
  var name = user ? (user.full_name || user.email) : currentUserId;

  if (!confirm('Delete ALL notes, tasks and events for ' + name + '? This cannot be undone.')) return;

  await Promise.all([
    supabase.from('notes').delete().eq('user_id', currentUserId),
    supabase.from('tasks').delete().eq('user_id', currentUserId),
    supabase.from('events').delete().eq('user_id', currentUserId)
  ]);

  addLog('action', '🗑 Admin deleted all content for: ' + name, 'action');
  toast('All content deleted for ' + name, 'success');
  await loadAll();
  loadUserData(currentUserId);
}

async function doDeleteAccount() {
  var user = allUsers.find(function(u) { return u.id === currentUserId; });
  var name = user ? (user.full_name || user.email) : currentUserId;

  if (!confirm('DELETE ACCOUNT for ' + name + '?\n\nThis deletes all their data and profile. The auth account must be removed from Supabase Dashboard.')) return;

  // Delete all data and profile
  await Promise.all([
    supabase.from('notes').delete().eq('user_id', currentUserId),
    supabase.from('tasks').delete().eq('user_id', currentUserId),
    supabase.from('events').delete().eq('user_id', currentUserId),
    supabase.from('profiles').delete().eq('id', currentUserId)
  ]);

  addLog('action', '❌ Admin deleted account: ' + name, 'action');
  toast('Profile and data deleted. Go to Supabase → Auth → Users to delete the auth account too.', 'info');
  closeModal('user-modal');
  await loadAll();
}

// ── BROADCAST ──
async function sendBroadcast() {
  var title = document.getElementById('bc-title').value.trim();
  var msg = document.getElementById('bc-msg').value.trim();
  if (!title || !msg) { toast('Please fill in title and message', 'error'); return; }

  // Save to announcements table
  await supabase.from('announcements').insert({ title: title, message: msg, created_at: new Date().toISOString() });

  broadcastList.unshift({ title: title, msg: msg, time: new Date().toISOString() });
  addLog('admin', '📢 Admin broadcast: ' + title, 'admin');
  toast('Announcement sent to all users ✓', 'success');

  document.getElementById('bc-title').value = '';
  document.getElementById('bc-msg').value = '';
  renderBroadcastList();
}

function renderBroadcastList() {
  var el = document.getElementById('bc-list');
  if (!broadcastList.length) { el.innerHTML = '<div class="empty">No announcements sent yet.</div>'; return; }
  el.innerHTML = broadcastList.map(function(b) {
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">' +
      '<div style="font-weight:600;margin-bottom:4px">' + esc(b.title) + '</div>' +
      '<div style="color:var(--muted);font-size:12px;margin-bottom:6px">' + esc(b.msg) + '</div>' +
      '<div class="mono text-muted" style="font-size:10px">' + fmtDateFull(b.time) + '</div>' +
      '</div>';
  }).join('');
}

// ── SETTINGS ──
function changeAdminPw() {
  var cur = document.getElementById('set-cur').value;
  var nw = document.getElementById('set-new').value;
  var cnf = document.getElementById('set-cnf').value;

  if (cur !== adminPw) { toast('Current password is incorrect', 'error'); return; }
  if (nw.length < 6) { toast('New password must be at least 6 characters', 'error'); return; }
  if (nw !== cnf) { toast('Passwords do not match', 'error'); return; }

  adminPw = nw;
  document.getElementById('set-cur').value = '';
  document.getElementById('set-new').value = '';
  document.getElementById('set-cnf').value = '';
  toast('Admin password changed ✓ (session only — update config.js to make it permanent)', 'success');
  addLog('admin', '🔐 Admin password changed', 'admin');
}

async function clearLogs() {
  if (!confirm('Clear all activity logs?')) return;
  await supabase.from('admin_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  activityLog = [];
  toast('Logs cleared', 'success');
  loadActivity();
}

async function confirmPurge() {
  if (!confirm('⚠ PURGE ALL USER CONTENT?\n\nThis deletes every note, task, and event from all users. This cannot be undone.')) return;
  await Promise.all([
    supabase.from('notes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  ]);
  addLog('admin', '⚠ Admin purged ALL user content', 'admin');
  toast('All user content purged', 'success');
  await loadAll();
}

// ── EXPORT ──
function exportUsers() {
  var csv = 'Name,Email,User ID,Created,Last Sign In,Notes,Tasks\n';
  allUsers.forEach(function(u) {
    var nc = allNotes.filter(function(n) { return n.user_id === u.id; }).length;
    var tc = allTasks.filter(function(t) { return t.user_id === u.id; }).length;
    csv += '"' + (u.full_name||'') + '","' + (u.email||'') + '","' + u.id + '","' + fmtDate(u.created_at) + '","' + (u.last_sign_in ? fmtDate(u.last_sign_in) : '') + '","' + nc + '","' + tc + '"\n';
  });
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'planr_users_' + new Date().toISOString().substring(0,10) + '.csv';
  a.click();
  toast('Users exported ✓', 'success');
  addLog('admin', '⬇ Admin exported users CSV', 'admin');
}

// ── MODAL / TAB HELPERS ──
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function switchDTab(name, btn) {
  document.querySelectorAll('.dtab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.dtab-content').forEach(function(c) { c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.getElementById('dtab-' + name).classList.add('active');
}

// ── TOAST ──
function toast(msg, type) {
  var wrap = document.getElementById('toasts');
  var el = document.createElement('div');
  el.className = 'toast-item ' + (type || 'info');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
}

// ── HELPERS ──
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateFull(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
