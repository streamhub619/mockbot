// reset-password-script.js
// Reads the ?token= param from the URL (put there by the reset email link),
// validates on load, then submits the new password.

const token = new URLSearchParams(window.location.search).get('token');

const form          = document.getElementById('reset-form');
const submitBtn     = document.getElementById('submit-btn');
const statusMessage = document.getElementById('status-message');

function showStatus(message, isError = false) {
  statusMessage.style.display    = 'block';
  statusMessage.textContent      = message;
  statusMessage.style.background = isError ? 'var(--clay-soft)' : 'var(--sage-soft)';
  statusMessage.style.color      = isError ? 'var(--clay)'      : 'var(--ink-soft)';
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent   = message;
  el.style.display = 'block';
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => {
    el.style.display = 'none';
    el.textContent   = '';
  });
}

// If there's no token in the URL, show an error immediately
if (!token) {
  showStatus('This reset link is missing or invalid. Please request a new one.', true);
  submitBtn.disabled = true;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const password = document.getElementById('password').value;
  const confirm  = document.getElementById('confirm').value;
  let hasError   = false;

  if (!password || password.length < 8) {
    showError('password-error', 'Password needs at least 8 characters.');
    hasError = true;
  }
  if (!/[A-Z]/.test(password)) {
    showError('password-error', 'Password must contain at least one uppercase letter.');
    hasError = true;
  }
  if (!/[0-9]/.test(password)) {
    showError('password-error', 'Password must contain at least one number.');
    hasError = true;
  }
  if (confirm !== password) {
    showError('confirm-error', "Passwords don't match.");
    hasError = true;
  }
  if (hasError) return;

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Updating…';

  try {
    const data = await AuthAPI.resetPassword(token, password);
    showStatus(data.message || 'Password updated successfully.');

    // Hide the form and redirect to login after a short delay
    form.style.display = 'none';
    setTimeout(() => { window.location.href = 'index.html'; }, 2000);

  } catch (err) {
    showStatus(err.message, true);
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Set new password';
  }
});
