requireAuth();
renderUserName();

document.querySelectorAll('.js-logout').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
});

// ─── Load everything in parallel ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    // Fire both requests at the same time
    const [statsData, sessionsData] = await Promise.all([
      SessionAPI.stats(),
      SessionAPI.list(),
    ]);

    // ── Stats ────────────────────────────────────────────────
    const stats      = statsData.stats;
    const allSessions = sessionsData.sessions || [];
    const completed  = allSessions.filter(s => s.status === 'completed').length;

    document.getElementById('stat-sessions').textContent = completed;
    document.getElementById('stat-nailed').textContent   = stats?.strong_count    || '0';
    document.getElementById('stat-revisit').textContent  = stats?.needs_work_count || '0';

    // ── Recent sessions list ─────────────────────────────────
    const list     = document.getElementById('session-list-body');
    const recent   = allSessions.slice(0, 3);

    if (recent.length === 0) {
      list.innerHTML = `
        <li class="session-item">
          <div class="session-date text-mist">No sessions yet — start one above!</div>
        </li>`;
      return;
    }

    list.innerHTML = recent.map(s => {
      const date   = new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const qCount = s.question_count || '—';
      const label  = s.jd_title || s.jd_company || s.session_type?.replace('_', ' ') || 'Practice session';
      const badge  = s.status === 'completed'
        ? `<span class="badge badge-success">Completed</span>`
        : `<span class="badge badge-neutral">${s.status}</span>`;

      return `
        <li class="session-item">
          <div>
            <div class="session-role">${label}</div>
            <div class="session-date text-mist">${date} · ${qCount} questions</div>
          </div>
          ${badge}
        </li>`;
    }).join('');

  } catch (err) {
    console.error('Dashboard load error:', err.message);
    document.getElementById('stat-sessions').textContent = '—';
    document.getElementById('stat-nailed').textContent   = '—';
    document.getElementById('stat-revisit').textContent  = '—';
  }
}

loadDashboard();
