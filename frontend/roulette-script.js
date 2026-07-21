requireAuth();
renderUserName();

document.querySelectorAll('.js-logout').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
});

// ─── State ────────────────────────────────────────────────────────────────────
let selectedRole    = 'any';
let matchId         = null;
let myRole          = null;      // 'interviewer' | 'interviewee'
let partnerName     = null;
let currentRound    = 1;
let totalRounds     = 7;
let rounds          = [];
let pollInterval    = null;
let timerInterval   = null;
let timerSeconds    = 0;
let submitting      = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const findBtn            = document.getElementById('find-btn');
const cancelBtn          = document.getElementById('cancel-btn');
const startBtn           = document.getElementById('start-btn');
const againBtn           = document.getElementById('again-btn');
const partnerAvatar      = document.getElementById('partner-avatar');
const partnerNameEl      = document.getElementById('partner-name');
const myRoleBadge        = document.getElementById('my-role-badge');
const roundCounter       = document.getElementById('round-counter');
const roundPath          = document.getElementById('round-path');
const timerDisplay       = document.getElementById('timer-display');
const interviewerView    = document.getElementById('interviewer-view');
const intervieweeView    = document.getElementById('interviewee-view');
const waitingBox         = document.getElementById('waiting-box');
const interviewerResult  = document.getElementById('interviewer-result');
const intervieweeResult  = document.getElementById('interviewee-result');
const nextBtnInterviewer = document.getElementById('next-btn-interviewer');
const answerInput        = document.getElementById('answer-input');
const submitAnswerBtn    = document.getElementById('submit-answer-btn');
const wordCount          = document.getElementById('word-count');
const waitingMsgEl       = document.getElementById('waiting-interviewer-msg');

// ─── Utility ─────────────────────────────────────────────────────────────────
function showState(id) {
  document.querySelectorAll('.roulette-state').forEach(el => el.classList.remove('is-visible'));
  document.getElementById(id).classList.add('is-visible');
}

function initials(name) {
  return (name || '?').split(' ').map(p => p[0]).join('').toUpperCase();
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function scoreClass(score) {
  if (!score) return 'score-adequate';
  return score >= 8 ? 'score-strong' : score >= 5 ? 'score-adequate' : 'score-weak';
}

function verdictLabel(verdict) {
  return verdict === 'Strong' ? 'nailed it' : verdict === 'Adequate' ? 'good effort' : 'worth revisiting';
}

function badgeClass(verdict) {
  return verdict === 'Strong' ? 'badge-success' : verdict === 'Adequate' ? 'badge-neutral' : 'badge-review';
}

function stopPolling()  { if (pollInterval)  { clearInterval(pollInterval);  pollInterval  = null; } }
function stopTimer()    { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

// ─── Role selector ────────────────────────────────────────────────────────────
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedRole = btn.dataset.role;
  });
});

// ─── Path bar ─────────────────────────────────────────────────────────────────
function renderPath(current, total, roundData) {
  roundPath.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const stone = document.createElement('div');
    stone.className = 'path-stone';
    const r = roundData.find(r => r.round_number === i);
    if (i === current)        stone.classList.add('is-active');
    else if (r?.submitted_at) {
      const v = r.verdict;
      stone.classList.add(v === 'Strong' ? 'is-correct' : v === 'Needs Work' ? 'is-review' : 'is-done');
    }
    roundPath.appendChild(stone);
    if (i < total) {
      const line = document.createElement('div');
      line.className = 'path-line';
      roundPath.appendChild(line);
    }
  }
}

// ─── Result card HTML ─────────────────────────────────────────────────────────
function buildResultCard(round) {
  const strengths   = round.strengths    || [];
  const missed      = round.missed       || [];
  const improvements = round.improvements || [];
  return `
    <div class="result-card">
      <div class="result-score-row">
        <div class="score-bubble ${scoreClass(round.score)}">${round.score ?? '—'}</div>
        <div>
          <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;color:var(--ink);">
            ${round.score ?? '—'}/10
          </div>
          <span class="badge ${badgeClass(round.verdict)}">${verdictLabel(round.verdict)}</span>
        </div>
      </div>
      <p class="result-feedback">${round.overall_feedback || ''}</p>
      <div class="result-cols">
        <div>
          <div class="result-col-title" style="color:var(--sage);">✓ STRENGTHS</div>
          ${strengths.map(s => `<div class="result-item" style="background:var(--sage-soft);color:var(--ink-soft);">${s}</div>`).join('') || '<div class="result-item" style="color:var(--mist);">—</div>'}
        </div>
        <div>
          <div class="result-col-title" style="color:var(--clay);">✗ MISSED</div>
          ${missed.map(m => `<div class="result-item" style="background:var(--clay-soft);color:var(--ink-soft);">${m}</div>`).join('') || '<div class="result-item" style="color:var(--mist);">—</div>'}
        </div>
      </div>
      ${improvements.length ? `
        <div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--sage-soft);border-radius:var(--radius-sm);">
          <div class="result-col-title" style="color:var(--sage);margin-bottom:var(--space-2);">→ TO IMPROVE</div>
          ${improvements.map(i => `<div style="font-size:var(--text-xs);color:var(--ink-soft);margin-bottom:4px;">· ${i}</div>`).join('')}
        </div>` : ''}
    </div>`;
}

// ─── Timer ───────────────────────────────────────────────────────────────────
function startRoundTimer(seconds = 180) {
  stopTimer();
  timerSeconds = seconds;
  timerDisplay.style.display = '';
  timerDisplay.classList.remove('warning');

  timerInterval = setInterval(() => {
    timerSeconds--;
    timerDisplay.textContent = `⏱ ${formatTime(timerSeconds)}`;
    if (timerSeconds <= 30) timerDisplay.classList.add('warning');
    if (timerSeconds <= 0) {
      stopTimer();
      timerDisplay.textContent = 'Time\'s up!';
      // Auto-submit with whatever they've typed
      if (!submitting && answerInput.value.trim()) {
        submitAnswerBtn.click();
      }
    }
  }, 1000);
}

// ─── Render a round ───────────────────────────────────────────────────────────
function renderRound(round, answered) {
  const isInterviewer = myRole === 'interviewer';
  roundCounter.textContent = `Round ${currentRound} of ${totalRounds}`;
  renderPath(currentRound, totalRounds, rounds);

  const metaHTML = `
    <span class="badge badge-neutral">${round.question_type || 'technical'}</span>
    <span class="badge badge-neutral">${round.question_category || 'General CS'}</span>`;

  if (isInterviewer) {
    document.getElementById('q-meta-interviewer').innerHTML = metaHTML;
    document.getElementById('q-text-interviewer').textContent = round.question_text;

    if (answered) {
      waitingBox.style.display       = 'none';
      interviewerResult.style.display = '';
      interviewerResult.innerHTML     = buildResultCard(round);
      nextBtnInterviewer.style.display = '';
      nextBtnInterviewer.textContent  = currentRound < totalRounds ? 'Next Question →' : 'View Summary →';
      nextBtnInterviewer.disabled     = false;
    } else {
      waitingBox.style.display        = '';
      interviewerResult.style.display = 'none';
      nextBtnInterviewer.style.display = 'none';
    }
  } else {
    document.getElementById('q-meta-interviewee').innerHTML = metaHTML;
    document.getElementById('q-text-interviewee').textContent = round.question_text;

    if (answered) {
      document.getElementById('answer-section').style.display = 'none';
      timerDisplay.style.display = 'none';
      stopTimer();
      intervieweeResult.style.display = '';
      intervieweeResult.innerHTML     = buildResultCard(round);
      waitingMsgEl.style.display      = '';
    } else {
      document.getElementById('answer-section').style.display = '';
      intervieweeResult.style.display = 'none';
      waitingMsgEl.style.display      = 'none';
      answerInput.value               = '';
      answerInput.disabled            = false;
      submitAnswerBtn.disabled        = false;
      submitting                      = false;
      startRoundTimer(180);
    }
  }
}

// ─── Show the session screen ──────────────────────────────────────────────────
function startSession() {
  showState('state-session');

  if (myRole === 'interviewer') {
    interviewerView.style.display = '';
    intervieweeView.style.display = 'none';
    timerDisplay.style.display    = 'none';
  } else {
    interviewerView.style.display = 'none';
    intervieweeView.style.display = '';
  }

  const round = rounds.find(r => r.round_number === currentRound);
  if (round) renderRound(round, !!round.submitted_at);
}

// ─── Polling for round updates ────────────────────────────────────────────────
function startSessionPoll() {
  stopPolling();
  pollInterval = setInterval(async () => {
    try {
      const data  = await RouletteAPI.getMatch(matchId);
      const match = data.match;
      rounds        = match.rounds || [];
      currentRound  = match.current_round;
      const round   = rounds.find(r => r.round_number === currentRound);

      if (match.status === 'completed') {
        stopPolling();
        showSummary(match);
        return;
      }

      if (round) renderRound(round, !!round.submitted_at);
    } catch (err) {
      console.warn('Session poll error:', err.message);
    }
  }, 3000);
}

// ─── Matchmaking poll (waiting for partner) ───────────────────────────────────
function startMatchPoll() {
  stopPolling();
  pollInterval = setInterval(async () => {
    try {
      const data = await RouletteAPI.pollMatch();
      if (data.status === 'generating') {
        showState('state-generating');
      } else if (data.status === 'active' || data.status === 'matched') {
        stopPolling();
        const match = data.match;
        matchId      = match.id;
        myRole       = match.role;
        rounds       = match.rounds || [];
        currentRound = match.current_round;
        totalRounds  = match.total_rounds;
        partnerName  = match.partner_name;
        showMatchedState(match);
      }
    } catch (err) {
      console.warn('Match poll error:', err.message);
    }
  }, 3000);
}

// ─── Show matched state ───────────────────────────────────────────────────────
function showMatchedState(match) {
  partnerAvatar.textContent = initials(match.partner_name);
  partnerNameEl.textContent = match.partner_name || 'Your partner';

  myRoleBadge.textContent  = myRole === 'interviewer' ? '🎙 Interviewer' : '✍️ Interviewee';
  myRoleBadge.className    = `role-badge role-badge-${myRole}`;

  showState('state-matched');
}

// ─── Summary screen ───────────────────────────────────────────────────────────
function showSummary(match) {
  stopTimer();
  const answeredRounds = (match.rounds || []).filter(r => r.submitted_at);
  const scores         = answeredRounds.map(r => Number(r.score)).filter(s => !isNaN(s));
  const avg            = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
  const strong         = answeredRounds.filter(r => r.verdict === 'Strong').length;
  const revisit        = answeredRounds.filter(r => r.verdict === 'Needs Work').length;

  document.getElementById('summary-avg').textContent     = avg;
  document.getElementById('summary-strong').textContent  = strong;
  document.getElementById('summary-revisit').textContent = revisit;

  const list = document.getElementById('summary-rounds');
  list.innerHTML = (match.rounds || []).map(r => `
    <li class="summary-round-item">
      <span class="summary-round-num">Q${r.round_number}</span>
      <span class="summary-round-q">${r.question_text.length > 70 ? r.question_text.slice(0, 70) + '…' : r.question_text}</span>
      ${r.verdict ? `<span class="badge ${badgeClass(r.verdict)}">${verdictLabel(r.verdict)}</span>` : '<span class="badge badge-neutral">skipped</span>'}
    </li>`).join('');

  showState('state-done');
}

// ─── Event listeners ──────────────────────────────────────────────────────────

// Find partner
findBtn.addEventListener('click', async () => {
  showState('state-searching');
  try {
    const result = await RouletteAPI.join(selectedRole);

    if (result.status === 'matched' || result.status === 'active') {
      const match  = result.match;
      matchId      = match.id;
      myRole       = result.role;
      rounds       = match.rounds || [];
      currentRound = match.current_round;
      totalRounds  = match.total_rounds;
      partnerName  = match.partner_name;

      if (match.status === 'generating') {
        showState('state-generating');
        startMatchPoll();
      } else {
        showMatchedState(match);
      }
    } else {
      // Waiting for a partner
      startMatchPoll();
    }
  } catch (err) {
    console.error('Join error:', err.message);
    showState('state-intro');
  }
});

// Cancel search
cancelBtn.addEventListener('click', async () => {
  stopPolling();
  try { await RouletteAPI.leave(); } catch {}
  showState('state-intro');
});

// Start session after match confirmed
startBtn.addEventListener('click', () => {
  startSession();
  startSessionPoll();
});

// Submit answer (interviewee)
answerInput.addEventListener('input', () => {
  const words = answerInput.value.trim().split(/\s+/).filter(Boolean).length;
  wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
});

submitAnswerBtn.addEventListener('click', async () => {
  if (submitting) return;
  const text = answerInput.value.trim();
  if (!text) { answerInput.style.borderColor = 'var(--clay)'; return; }

  submitting            = true;
  submitAnswerBtn.disabled    = true;
  submitAnswerBtn.textContent = 'Evaluating…';
  stopTimer();

  try {
    const data = await RouletteAPI.submitRound(matchId, currentRound, text);
    const updatedRound = { ...rounds.find(r => r.round_number === currentRound), ...data.round, ...data.evaluation };
    rounds = rounds.map(r => r.round_number === currentRound ? updatedRound : r);
    renderRound(updatedRound, true);
  } catch (err) {
    console.error('Submit error:', err.message);
    submitAnswerBtn.disabled    = false;
    submitAnswerBtn.textContent = 'Submit answer →';
    submitting                  = false;
  }
});

// Advance round (interviewer)
nextBtnInterviewer.addEventListener('click', async () => {
  nextBtnInterviewer.disabled    = true;
  nextBtnInterviewer.textContent = 'Advancing…';

  try {
    await RouletteAPI.advanceRound(matchId);
    // Poll will pick up the new current_round
  } catch (err) {
    console.error('Advance error:', err.message);
    nextBtnInterviewer.disabled    = false;
    nextBtnInterviewer.textContent = currentRound < totalRounds ? 'Next Question →' : 'View Summary →';
  }
});

// Find another partner
againBtn.addEventListener('click', () => {
  stopPolling();
  stopTimer();
  matchId = null; myRole = null; rounds = []; currentRound = 1;
  showState('state-intro');
});
