// feedback.html — replace the existing <script>...</script> block with this
// Also add <script src="api.js"></script> BEFORE this script tag
// Add id="feedback-heading" to the <h1>
// Add id="feedback-meta" to the <p class="text-mist"> subtitle
// Add id="feedback-stat-nailed" and id="feedback-stat-revisit" to the stat spans
// Add id="feedback-question-path" to the second .path-bar
// Add id="feedback-list" to the <ul class="feedback-list">

requireAuth();
renderUserName();

document.querySelectorAll('.js-logout').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
});

async function loadFeedback() {
  const sessionId = Store.get('session_id');
  if (!sessionId) {
    window.location.href = 'dashboard.html';
    return;
  }

  try {
    const data    = await SessionAPI.get(sessionId);
    const session = data.session;
    const answers = session.answers || [];
    const qs      = session.questions || [];

    // ── Heading ──────────────────────────────────────────────
    const user     = Auth.getUser();
    const heading  = document.getElementById('feedback-heading');
    if (heading) heading.textContent = `Nice work, ${user?.fullName?.split(' ')[0] || 'there'}`;

    // ── Subtitle meta ─────────────────────────────────────────
    const meta  = document.getElementById('feedback-meta');
    const date  = new Date(session.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const label = session.jd_title || session.session_type?.replace('_', ' ') || 'Practice session';
    if (meta) meta.textContent = `${label} · ${date} · ${qs.length} questions`;

    // ── Map answer data by question_id ────────────────────────
    const answerMap = {};
    answers.forEach(a => { answerMap[a.question_id] = a; });

    // ── Summary stats ─────────────────────────────────────────
    const nailed  = answers.filter(a => a.verdict === 'Strong').length;
    const revisit = answers.filter(a => a.verdict === 'Needs Work').length;
    const nailedEl  = document.getElementById('feedback-stat-nailed');
    const revisitEl = document.getElementById('feedback-stat-revisit');
    if (nailedEl)  nailedEl.textContent  = nailed;
    if (revisitEl) revisitEl.textContent = revisit;

    // ── Question path bar ─────────────────────────────────────
    const pathEl = document.getElementById('feedback-question-path');
    if (pathEl) {
      pathEl.innerHTML = '';
      qs.forEach((q, i) => {
        const a     = answerMap[q.id];
        const stone = document.createElement('div');
        stone.className = 'path-stone';
        if (!a)                          stone.classList.add('is-done');      // no answer
        else if (a.verdict === 'Strong') stone.classList.add('is-correct');
        else if (a.verdict === 'Needs Work') stone.classList.add('is-review');
        else                             stone.classList.add('is-done');      // Adequate
        pathEl.appendChild(stone);
        if (i < qs.length - 1) {
          const line = document.createElement('div');
          line.className = 'path-line';
          pathEl.appendChild(line);
        }
      });
    }

    // ── Per-question feedback list ────────────────────────────
    const list = document.getElementById('feedback-list');
    if (list) {
      list.innerHTML = qs.map((q, i) => {
        const a = answerMap[q.id];
        const verdictLabel = !a ? 'not answered'
          : a.verdict === 'Strong'     ? 'nailed it'
          : a.verdict === 'Adequate'   ? 'good effort'
          : 'worth revisiting';
        const badgeClass = !a ? 'badge-neutral'
          : a.verdict === 'Strong'   ? 'badge-success'
          : a.verdict === 'Adequate' ? 'badge-neutral'
          : 'badge-review';

        // Build the "what you missed" note
        const missedItems = a?.missed || [];
        const noteHTML = missedItems.length > 0
          ? `<div class="feedback-item-note">${a.overall_feedback || ''}<br>
               <strong>What to add next time:</strong> ${missedItems.join('; ')}.
             </div>`
          : a?.overall_feedback
          ? `<div class="feedback-item-note">${a.overall_feedback}</div>`
          : '';

        return `
          <li class="feedback-item">
            <div class="feedback-item-header">
              <span class="feedback-item-num">Q${i + 1}</span>
              <span class="feedback-item-question">${q.text}</span>
              <span class="badge ${badgeClass}">${verdictLabel}</span>
            </div>
            ${noteHTML}
          </li>`;
      }).join('');
    }

    // ── Clear session store once rendered ─────────────────────
    Store.remove('session_id');

  } catch (err) {
    console.error('Failed to load feedback:', err.message);
  }
}

loadFeedback();
