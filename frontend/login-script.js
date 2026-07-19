// login-script.js
if (Auth.isLoggedIn()) window.location.href = 'dashboard.html';

const form          = document.getElementById('auth-form');
const formTitle     = document.getElementById('form-title');
const nameField     = document.getElementById('name-field');
const confirmField  = document.getElementById('confirm-field');
const forgotField   = document.getElementById('forgot-email-field');
const emailWrapper  = document.getElementById('email-wrapper');
const passWrapper   = document.getElementById('password-wrapper');
const forgotLink    = document.getElementById('forgot-link');
const submitBtn     = document.getElementById('submit-btn');
const switchBtn     = document.getElementById('switch-btn');
const switchPrompt  = document.getElementById('switch-prompt');
const switchRow     = document.getElementById('switch-row');
const statusMessage = document.getElementById('status-message');

// mode: 'login' | 'register' | 'forgot'
let mode = 'login';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => {
    el.style.display = 'none';
    el.textContent   = '';
  });
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent   = message;
  el.style.display = 'block';
}

function showStatus(message, isError = false) {
  statusMessage.style.display = 'block';
  statusMessage.textContent   = message;
  statusMessage.style.background = isError ? 'var(--clay-soft)' : 'var(--sage-soft)';
  statusMessage.style.color      = isError ? 'var(--clay)'      : 'var(--ink-soft)';
}

function hideStatus() {
  statusMessage.style.display = 'none';
}

// ─── Mode switching ───────────────────────────────────────────────────────────
function setMode(newMode) {
  mode = newMode;
  clearErrors();
  hideStatus();
  form.reset();

  // Show/hide fields and labels based on mode
  const show = (...els) => els.forEach(el => el && (el.style.display = 'block'));
  const hide = (...els) => els.forEach(el => el && (el.style.display = 'none'));

  if (mode === 'login') {
    formTitle.textContent   = 'Welcome back';
    submitBtn.textContent   = 'Log in';
    switchPrompt.textContent = "Don't have an account?";
    switchBtn.textContent   = 'Create one';

    show(emailWrapper, passWrapper, forgotLink);
    hide(nameField, confirmField, forgotField);
    switchRow.style.display = '';

  } else if (mode === 'register') {
    formTitle.textContent   = 'Create your account';
    submitBtn.textContent   = 'Create account';
    switchPrompt.textContent = 'Already have an account?';
    switchBtn.textContent   = 'Log in';

    show(nameField, emailWrapper, passWrapper, confirmField);
    hide(forgotLink, forgotField);
    switchRow.style.display = '';

  } else if (mode === 'forgot') {
    formTitle.textContent = 'Reset your password';
    submitBtn.textContent = 'Send reset link';

    show(forgotField);
    hide(nameField, emailWrapper, passWrapper, confirmField, forgotLink);
    switchRow.style.display = 'none';
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────
switchBtn.addEventListener('click', () => {
  setMode(mode === 'login' ? 'register' : 'login');
});

forgotLink.addEventListener('click', () => setMode('forgot'));

// ─── Form submit ──────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  let hasError = false;

  // ── Login ──────────────────────────────────────────────────────────────────
  if (mode === 'login') {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !email.includes('@')) { showError('email-error', 'Enter a valid email.'); hasError = true; }
    if (!password)                       { showError('password-error', 'Password is required.'); hasError = true; }
    if (hasError) return;

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Logging in…';

    try {
      await AuthAPI.login(email, password);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showStatus(err.message, true);
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Log in';
    }

  // ── Register ────────────────────────────────────────────────────────────────
  } else if (mode === 'register') {
    const fullName = document.getElementById('name').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm').value;

    if (!fullName)                       { showError('name-error',     'Tell us what to call you.'); hasError = true; }
    if (!email || !email.includes('@'))  { showError('email-error',    'Enter a valid email.'); hasError = true; }
    if (!password || password.length < 8){ showError('password-error', 'Password needs at least 8 characters.'); hasError = true; }
    if (confirm !== password)            { showError('confirm-error',  "Passwords don't match."); hasError = true; }
    if (hasError) return;

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Creating account…';

    try {
      await AuthAPI.register(fullName, email, password);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showStatus(err.message, true);
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Create account';
    }

  // ── Forgot password ─────────────────────────────────────────────────────────
  } else if (mode === 'forgot') {
    const email = document.getElementById('forgot-email').value.trim();

    if (!email || !email.includes('@')) {
      showError('forgot-email-error', 'Enter a valid email address.');
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending…';

    try {
      const data = await AuthAPI.forgotPassword(email);
      showStatus(data.message || 'If that email is registered, a reset link has been sent.');

      // Show a "back to login" link below the status
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Send reset link';

      // After success, offer to go back to login
      switchRow.style.display = '';
      switchPrompt.textContent = 'Remembered it?';
      switchBtn.textContent    = 'Back to login';
      switchBtn.onclick        = () => setMode('login');

    } catch (err) {
      showStatus(err.message, true);
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Send reset link';
    }
  }
});

// Initialise in login mode
setMode('login');
