// dashboard.html — replace the existing <script>...</script> block with this
// Also add <script src="api.js"></script> BEFORE this script tag
// Replace all "Hi, Asha" text nodes with: <span class="dash-greeting">Hi, <span class="js-user-name">there</span></span>
// Add id="stat-sessions" / id="stat-nailed" / id="stat-revisit" to the .stat-value divs
// Add id="session-list-body" to the <ul class="session-list">
// Add class="js-logout" to the Log out link

requireAuth();
renderUserName();

// Wire up logout
document.querySelectorAll('.js-logout').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
});

// ─── Stats ────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await SessionAPI.stats();
    const stats = data.stats;

    const sessions = document.getElementById('stat-sessions');
    const nailed   = document.getElementById('stat-nailed');
    const revisit  = document.getElementById('stat-revisit');

    if (sessions) sessions.textContent = data.recentAnswers?.length
      ? (await SessionAPI.list()).sessions?.length || '0'
      : '0';
    if (nailed)   nailed.textContent   = stats?.strong_count    || '0';
    if (revisit)  revisit.textContent  = stats?.needs_work_count || '0';
  } catch (err) {
    console.error('Could not load stats:', err.message);
  }
}

// ─── Recent sessions ─────────────────────────────────────────────────────────
async function loadRecentSessions() {
  const list = document.getElementById('session-list-body');
  if (!list) return;

  try {
    const data = await SessionAPI.list();
    const sessions = (data.sessions || []).slice(0, 3);

    if (sessions.length === 0) {
      list.innerHTML = `<li class="session-item"><div class="session-date text-mist">No sessions yet — start one above!</div></li>`;
      return;
    }

    list.innerHTML = sessions.map(s => {
      const date    = new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const qCount  = s.question_count || '—';
      const label   = s.jd_title || s.session_type?.replace('_', ' ') || 'Practice session';

      return `
        <li class="session-item">
          <div>
            <div class="session-role">${label}</div>
            <div class="session-date text-mist">${date} · ${qCount} questions</div>
          </div>
          <span class="badge badge-${s.status === 'completed' ? 'success' : 'neutral'}">
            ${s.status === 'completed' ? 'Completed' : s.status}
          </span>
        </li>`;
    }).join('');
  } catch (err) {
    console.error('Could not load sessions:', err.message);
  }
}

loadStats();
loadRecentSessions();
