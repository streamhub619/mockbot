requireAuth();
renderUserName();

document.querySelectorAll('.js-logout').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
});

const container = document.getElementById('history-container');

// ─── Score helpers ────────────────────────────────────────────────────────────
function scoreClass(score) {
  if (score === null || score === undefined) return 'score-none';
  if (score >= 8) return 'score-strong';
  if (score >= 5) return 'score-adequate';
  return 'score-weak';
}

function scoreLabel(score) {
  if (score === null || score === undefined) return '—';
  return Number(score).toFixed(1);
}

function verdictBadge(verdict) {
  if (!verdict) return '';
  const cls = verdict === 'Strong' ? 'badge-success'
            : verdict === 'Adequate' ? 'badge-neutral'
            : 'badge-review';
  const label = verdict === 'Strong' ? 'nailed it'
              : verdict === 'Adequate' ? 'good effort'
              : 'worth revisiting';
  return `<span class="badge ${cls}">${label}</span>`;
}

// ─── Build path bar dots from answers ────────────────────────────────────────
function buildPathBar(questions, answerMap) {
  if (!questions.length) return '';
  return `<div class="path-bar session-path">
    ${questions.map((q, i) => {
      const a = answerMap[q.id];
      const stateClass = !a ? ''
        : a.verdict === 'Strong'     ? 'is-correct'
        : a.verdict === 'Needs Work' ? 'is-review'
        : 'is-done';
      return `<div class="path-stone ${stateClass}"></div>${i < questions.length - 1 ? '<div class="path-line"></div>' : ''}`;
    }).join('')}
  </div>`;
}

// ─── Build expanded Q&A list ─────────────────────────────────────────────────
function buildDetailList(questions, answerMap) {
  if (!questions.length) return '<p class="text-mist" style="font-size:var(--text-sm)">No questions found for this session.</p>';

  return `<ul class="detail-q-list">
    ${questions.map((q, i) => {
      const a = answerMap[q.id];
      const missed = a?.missed || [];
      const noteHTML = missed.length > 0
        ? `<div class="detail-q-note"><strong>What to add next time:</strong> ${missed.join('; ')}.</div>`
        : a?.overall_feedback
        ? `<div class="detail-q-note">${a.overall_feedback}</div>`
        : '';

      return `
        <li class="detail-q-item">
          <span class="detail-q-num">Q${i + 1}</span>
          <div class="detail-q-text">
            <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;margin-bottom:${noteHTML ? 'var(--space-1)' : '0'}">
              <span>${q.text}</span>
              ${a ? verdictBadge(a.verdict) : '<span class="badge badge-neutral">not answered</span>'}
            </div>
            ${noteHTML}
          </div>
        </li>`;
    }).join('')}
  </ul>`;
}

// ─── Fetch and render a single session's detail on expand ────────────────────
async function loadDetail(sessionId, detailEl) {
  if (detailEl.dataset.loaded) return; // already fetched

  detailEl.innerHTML = '<p class="text-mist" style="font-size:var(--text-sm)">Loading…</p>';

  try {
    const data      = await SessionAPI.get(sessionId);
    const session   = data.session;
    const questions = session.questions || [];
    const answers   = session.answers   || [];

    const answerMap = {};
    answers.forEach(a => { answerMap[a.question_id] = a; });

    detailEl.innerHTML = buildDetailList(questions, answerMap);
    detailEl.dataset.loaded = 'true';
  } catch (err) {
    detailEl.innerHTML = `<p style="color:var(--clay);font-size:var(--text-sm)">Could not load session detail.</p>`;
    console.error('Detail load error:', err.message);
  }
}

// ─── Render the full history list ─────────────────────────────────────────────
async function loadHistory() {
  try {
    const data     = await SessionAPI.list();
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="history-empty">
          <h2>No sessions yet</h2>
          <p>Complete your first mock interview and it'll show up here.</p>
          <a href="resume-upload.html" class="btn btn-primary" style="margin-top:var(--space-4)">Start a session</a>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="session-grid" id="session-grid"></div>`;
    const grid = document.getElementById('session-grid');

    sessions.forEach(s => {
      const date     = new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const label    = s.jd_title || s.jd_company || s.session_type?.replace('_', ' ') || 'Practice session';
      const qCount   = s.question_count || 0;
      const score    = s.total_score;

      const statusBadge = s.status === 'completed'
        ? '' // score circle speaks for itself
        : `<span class="badge badge-neutral" style="margin-left:auto">${s.status}</span>`;

      const card = document.createElement('div');
      card.className = 'session-card';
      card.dataset.sessionId = s.id;
      card.innerHTML = `
        <div class="session-card-header">
          <div class="session-score ${scoreClass(score)}">${scoreLabel(score)}</div>
          <div class="session-info">
            <div class="session-title">${label}</div>
            <div class="session-meta">${date} · ${qCount} question${qCount !== 1 ? 's' : ''} · ${s.session_type?.replace('_', ' ') || ''}</div>
          </div>
          ${statusBadge}
          <span class="chevron">›</span>
        </div>
        <div class="session-detail" id="detail-${s.id}"></div>`;

      // Toggle expand on click
      card.addEventListener('click', async () => {
        const isOpen   = card.classList.contains('is-open');
        const detailEl = document.getElementById(`detail-${s.id}`);

        // Close any currently open card
        document.querySelectorAll('.session-card.is-open').forEach(c => {
          c.classList.remove('is-open');
          c.querySelector('.session-detail').classList.remove('is-open');
        });

        if (!isOpen) {
          card.classList.add('is-open');
          detailEl.classList.add('is-open');
          await loadDetail(s.id, detailEl);
        }
      });

      grid.appendChild(card);
    });

  } catch (err) {
    container.innerHTML = `
      <div class="history-empty">
        <h2>Could not load history</h2>
        <p>${err.message}</p>
      </div>`;
    console.error('History load error:', err.message);
  }
}

loadHistory();
