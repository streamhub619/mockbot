// =============================================================================
//  MockBot — API Layer  (api.js)
// =============================================================================

const API_BASE = 'http://localhost:5000/api';

// ─── Token helpers ────────────────────────────────────────────────────────────
const Auth = {
  getToken()    { return localStorage.getItem('mb_token'); },
  setToken(t)   { localStorage.setItem('mb_token', t); },
  removeToken() { localStorage.removeItem('mb_token'); },
  getUser()     { return JSON.parse(localStorage.getItem('mb_user') || 'null'); },
  setUser(u)    { localStorage.setItem('mb_user', JSON.stringify(u)); },
  removeUser()  { localStorage.removeItem('mb_user'); },
  isLoggedIn()  { return !!Auth.getToken(); },
  logout() {
    Auth.removeToken();
    Auth.removeUser();
    window.location.href = 'index.html';
  },
};

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token   = Auth.getToken();
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) { Auth.logout(); return; }

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
      body:   JSON.stringify({ email, password }),
    });
    Auth.setToken(data.token);
    Auth.setUser(data.user);
    return data.user;
  },

  async register(fullName, email, password) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ fullName, email, password }),
    });
    Auth.setToken(data.token);
    Auth.setUser(data.user);
    return data.user;
  },

  async me() {
    return apiFetch('/auth/me');
  },

  async forgotPassword(email) {
    return apiFetch('/auth/forgot-password', {
      method: 'POST',
      body:   JSON.stringify({ email }),
    });
  },

  async resetPassword(token, password) {
    return apiFetch('/auth/reset-password', {
      method: 'POST',
      body:   JSON.stringify({ token, password }),
    });
  },
};

// ─── Resume API ───────────────────────────────────────────────────────────────
const ResumeAPI = {
  async upload(file) {
    const form = new FormData();
    form.append('resume', file);
    return apiFetch('/resumes', { method: 'POST', body: form });
  },
  async list() { return apiFetch('/resumes'); },
};

// ─── Job Description API ──────────────────────────────────────────────────────
const JobDescriptionAPI = {
  async create(descriptionText, title = '', company = '') {
    return apiFetch('/job-descriptions', {
      method: 'POST',
      body:   JSON.stringify({ descriptionText, title, company }),
    });
  },
};

// ─── Session API ──────────────────────────────────────────────────────────────
const SessionAPI = {
  async create(resumeId, jobDescriptionId, sessionType = 'resume_tailored') {
    return apiFetch('/sessions', {
      method: 'POST',
      body:   JSON.stringify({ resumeId, jobDescriptionId, sessionType }),
    });
  },
  async get(sessionId)  { return apiFetch(`/sessions/${sessionId}`); },
  async list()          { return apiFetch('/sessions'); },
  async complete(id)    { return apiFetch(`/sessions/${id}/complete`, { method: 'PATCH' }); },
  async stats()         { return apiFetch('/sessions/history/stats'); },
};

// ─── Answer API ───────────────────────────────────────────────────────────────
const AnswerAPI = {
  async submit(sessionId, questionId, answerText) {
    return apiFetch('/answers', {
      method: 'POST',
      body:   JSON.stringify({ sessionId, questionId, answerText }),
    });
  },
};

// ─── Roulette API ─────────────────────────────────────────────────────────────
const RouletteAPI = {
  async join()            { return apiFetch('/roulette/join', { method: 'POST' }); },
  async leave()           { return apiFetch('/roulette/leave', { method: 'DELETE' }); },
  async pollMatch()       { return apiFetch('/roulette/match'); },
  async getMatch(id)      { return apiFetch(`/roulette/matches/${id}`); },
  async submitAnswer(id, answerText) {
    return apiFetch(`/roulette/matches/${id}/submit`, {
      method: 'POST',
      body:   JSON.stringify({ answerText }),
    });
  },
};

// ─── Guards & helpers ─────────────────────────────────────────────────────────
function requireAuth() {
  if (!Auth.isLoggedIn()) window.location.href = 'index.html';
}

function renderUserName() {
  const user = Auth.getUser();
  if (!user) return;
  document.querySelectorAll('.js-user-name').forEach(el => {
    el.textContent = user.fullName?.split(' ')[0] || 'there';
  });
}

const Store = {
  set(key, value) { sessionStorage.setItem(`mb_${key}`, JSON.stringify(value)); },
  get(key) {
    try { return JSON.parse(sessionStorage.getItem(`mb_${key}`)); }
    catch { return null; }
  },
  remove(key) { sessionStorage.removeItem(`mb_${key}`); },
};
