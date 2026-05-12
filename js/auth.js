// ============================================================
//  AUTH.JS — Login / Signup Logic
// ============================================================

// Check if already logged in → redirect to dashboard
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.href = 'dashboard.html';
})();

function switchTab(tab) {
  const tabs = document.querySelectorAll('.tab-btn');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const title = document.getElementById('form-title');
  const subtitle = document.getElementById('form-subtitle');

  if (tab === 'login') {
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
    title.textContent = 'Welcome back';
    subtitle.textContent = 'Sign in to your workspace';
  } else {
    tabs[1].classList.add('active');
    tabs[0].classList.remove('active');
    signupForm.classList.add('active');
    loginForm.classList.remove('active');
    title.textContent = 'Get started';
    subtitle.textContent = 'Create your free workspace';
  }
}

function showAlert(id, message, type) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `alert ${type} show`;
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (loading) btn.classList.add('loading');
  else btn.classList.remove('loading');
  btn.disabled = loading;
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showAlert('login-alert', 'Please fill in all fields.', 'error');
    return;
  }

  setLoading('login-btn', true);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showAlert('login-alert', error.message, 'error');
    setLoading('login-btn', false);
    return;
  }

  showAlert('login-alert', 'Signing you in...', 'success');
  setTimeout(() => window.location.href = 'dashboard.html', 600);
}

async function handleSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!name || !email || !password) {
    showAlert('signup-alert', 'Please fill in all fields.', 'error');
    return;
  }
  if (password.length < 6) {
    showAlert('signup-alert', 'Password must be at least 6 characters.', 'error');
    return;
  }

  setLoading('signup-btn', true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });

  if (error) {
    showAlert('signup-alert', error.message, 'error');
    setLoading('signup-btn', false);
    return;
  }

  // Insert profile row
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      full_name: name,
      email: email,
      created_at: new Date().toISOString()
    });
  }

  showAlert('signup-alert', 'Account created! Check your email to confirm, then sign in.', 'success');
  setLoading('signup-btn', false);

  // If email confirmation is disabled, redirect directly
  if (data.session) {
    setTimeout(() => window.location.href = 'dashboard.html', 800);
  }
}

// Enter key support
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const loginActive = document.getElementById('login-form').classList.contains('active');
    if (loginActive) handleLogin();
    else handleSignup();
  }
});
