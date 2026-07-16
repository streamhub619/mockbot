// =============================================================================
//  MockBot — API Layer  (api.js)
//  Drop this file alongside your HTML files and include it before any
//  page-specific <script> tags:  <script src="api.js"></script>
// =============================================================================

const API_BASE = 'http://localhost:5000/api';

// ─── Token helpers ────────────────────────────────────────────────────────────
const Auth = {
  getToken()          { return localStorage.getItem('mb_token'); },
  setToken(token)     { localStorage.setItem('mb_token', token); },
  removeToken()       { localStorage.removeItem('mb_token'); },
  getUser()           { return JSON.parse(localStorage.getItem('mb_user') || 'null'); },
  setUser(user)       { localStorage.setItem('mb_user', JSON.stringify(user)); },
  removeUser()        { localStorage.removeItem('mb_user'); },
  isLoggedIn()        { return !!Auth.getToken(); },
  logout() {
    Auth.removeToken();
    Auth.removeUser();
    window.location.href = 'login.html';
  },
};

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = { ...(options.headers || {}) };

  // Only set Content-Type for JSON bodies (not FormData)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Token expired / invalid — kick to login
  if (res.status === 401) {
    Auth.logout();
    return;
  }

  const data = await res.json();
  if (!res.ok) {
    const message = data.error || data.errors?.[0]?.msg || 'Something went wrong.';
    throw new Error(message);
  }
  return data;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
const AuthAPI = {
  async login(email, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    Auth.setToken(data.token);
    Auth.setUser(data.user);
    return data.user;
  },

  async register(fullName, email, password) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password }),
    });
    Auth.setToken(data.token);
    Auth.setUser(data.user);
    return data.user;
  },

  async me() {
    return apiFetch('/auth/me');
  },
};

// ─── Resume API ───────────────────────────────────────────────────────────────
const ResumeAPI = {
  async upload(file) {
    const form = new FormData();
    form.append('resume', file);
    return apiFetch('/resumes', { method: 'POST', body: form });
  },

  async list() {
    return apiFetch('/resumes');
  },
};

// ─── Job Description API ──────────────────────────────────────────────────────
const JobDescriptionAPI = {
  async create(descriptionText, title = '', company = '') {
    return apiFetch('/job-descriptions', {
      method: 'POST',
      body: JSON.stringify({ descriptionText, title, company }),
    });
  },
};

// ─── Session API ──────────────────────────────────────────────────────────────
const SessionAPI = {
  async create(resumeId, jobDescriptionId) {
    return apiFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        sessionType: 'resume_tailored',
        resumeId,
        jobDescriptionId,
      }),
    });
  },

  async get(sessionId) {
    return apiFetch(`/sessions/${sessionId}`);
  },

  async list() {
    return apiFetch('/sessions');
  },

  async complete(sessionId) {
    return apiFetch(`/sessions/${sessionId}/complete`, { method: 'PATCH' });
  },

  async stats() {
    return apiFetch('/sessions/history/stats');
  },
};

// ─── Answer API ───────────────────────────────────────────────────────────────
const AnswerAPI = {
  async submit(sessionId, questionId, answerText) {
    return apiFetch('/answers', {
      method: 'POST',
      body: JSON.stringify({ sessionId, questionId, answerText }),
    });
  },
};

// ─── Roulette API ─────────────────────────────────────────────────────────────
const RouletteAPI = {
  async join() {
    return apiFetch('/roulette/join', { method: 'POST' });
  },

  async leave() {
    return apiFetch('/roulette/leave', { method: 'DELETE' });
  },

  async pollMatch() {
    return apiFetch('/roulette/match');
  },

  async getMatch(matchId) {
    return apiFetch(`/roulette/matches/${matchId}`);
  },

  async submitAnswer(matchId, answerText) {
    return apiFetch(`/roulette/matches/${matchId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answerText }),
    });
  },
};

// ─── Page guard — call at top of every protected page ────────────────────────
// Redirects to login.html if the user is not authenticated.
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
  }
}

// ─── Fill in the logged-in user's name wherever .js-user-name appears ────────
function renderUserName() {
  const user = Auth.getUser();
  if (!user) return;
  document.querySelectorAll('.js-user-name').forEach(el => {
    el.textContent = user.fullName?.split(' ')[0] || 'there';
  });
}

// ─── Session storage helpers (pass data between pages) ────────────────────────
const Store = {
  set(key, value) { sessionStorage.setItem(`mb_${key}`, JSON.stringify(value)); },
  get(key)        {
    try { return JSON.parse(sessionStorage.getItem(`mb_${key}`)); }
    catch { return null; }
  },
  remove(key)     { sessionStorage.removeItem(`mb_${key}`); },
};
