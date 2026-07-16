// login.html — replace the existing <script>...</script> block with this
// Also add <script src="api.js"></script> BEFORE this script tag

// If already logged in, skip straight to dashboard
if (Auth.isLoggedIn()) {
  window.location.href = 'dashboard.html';
}

const form = document.getElementById('auth-form');
const formTitle = document.getElementById('form-title');
const nameField = document.getElementById('name-field');
const confirmField = document.getElementById('confirm-field');
const submitBtn = document.getElementById('submit-btn');
const switchBtn = document.getElementById('switch-btn');
const switchPrompt = document.getElementById('switch-prompt');
const statusMessage = document.getElementById('status-message');

let mode = 'login';

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => {
    el.style.display = 'none';
    el.textContent = '';
  });
}

function showError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.style.display = 'block';
}

function showStatus(message, isError = false) {
  statusMessage.style.display = 'block';
  statusMessage.textContent = message;
  statusMessage.style.background = isError ? 'var(--clay-soft)' : 'var(--sage-soft)';
  statusMessage.style.color = isError ? 'var(--clay)' : 'var(--ink-soft)';
}

function setMode(newMode) {
  mode = newMode;
  clearErrors();
  statusMessage.style.display = 'none';
  form.reset();

  if (mode === 'login') {
    formTitle.textContent = 'Welcome back';
    nameField.style.display = 'none';
    confirmField.style.display = 'none';
    submitBtn.textContent = 'Log in';
    switchPrompt.textContent = "Don't have an account?";
    switchBtn.textContent = 'Create one';
  } else {
    formTitle.textContent = 'Create your account';
    nameField.style.display = 'block';
    confirmField.style.display = 'block';
    submitBtn.textContent = 'Create account';
    switchPrompt.textContent = 'Already have an account?';
    switchBtn.textContent = 'Log in';
  }
}

switchBtn.addEventListener('click', () => {
  setMode(mode === 'login' ? 'register' : 'login');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  let hasError   = false;

  if (mode === 'register' && !document.getElementById('name').value.trim()) {
    showError('name-error', 'Tell us what to call you.');
    hasError = true;
  }
  if (!email || !email.includes('@')) {
    showError('email-error', 'Enter a valid email address.');
    hasError = true;
  }
  if (!password || password.length < 8) {
    showError('password-error', 'Password needs at least 8 characters.');
    hasError = true;
  }
  if (mode === 'register') {
    const confirm = document.getElementById('confirm').value;
    if (confirm !== password) {
      showError('confirm-error', "Passwords don't match.");
      hasError = true;
    }
  }
  if (hasError) return;

  submitBtn.disabled = true;
  submitBtn.textContent = mode === 'login' ? 'Logging in…' : 'Creating account…';

  try {
    if (mode === 'login') {
      await AuthAPI.login(email, password);
    } else {
      const fullName = document.getElementById('name').value.trim();
      await AuthAPI.register(fullName, email, password);
    }
    window.location.href = 'dashboard.html';
  } catch (err) {
    showStatus(err.message, true);
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'login' ? 'Log in' : 'Create account';
  }
});
