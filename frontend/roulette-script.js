// mock-roulette.html — replace the existing <script>...</script> block with this
// Also add <script src="api.js"></script> BEFORE this script tag

requireAuth();
renderUserName();

document.querySelectorAll('.js-logout').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
});

// DOM refs
const findBtn         = document.getElementById('find-btn');
const cancelBtn       = document.getElementById('cancel-btn');
const startSessionBtn = document.getElementById('start-session-btn');
const nextRoundBtn    = document.getElementById('next-round-btn');
const againBtn        = document.getElementById('again-btn');
const partnerAvatar   = document.getElementById('partner-avatar');
const partnerName     = document.getElementById('partner-name');
const partnerRole     = document.getElementById('partner-role');
const roundPath       = document.getElementById('round-path');
const roundLabel      = document.getElementById('round-label');
const roundAsker      = document.getElementById('round-asker');
const roundQuestion   = document.getElementById('round-question');

let matchId       = null;
let matchData     = null;
let pollInterval  = null;
let answerSubmitted = false;

function showState(id) {
  document.querySelectorAll('.roulette-state').forEach(el => el.classList.remove('is-visible'));
  document.getElementById(id).classList.add('is-visible');
}

function initials(name) {
  return (name || '?').split(' ').map(p => p[0]).join('').toUpperCase();
}

// ─── Polling for a match ──────────────────────────────────────────────────────
function startPolling() {
  pollInterval = setInterval(async () => {
    try {
      const data = await RouletteAPI.pollMatch();
      if (data.status === 'matched') {
        clearInterval(pollInterval);
        matchId   = data.match.id;
        matchData = data.match;
        showMatchedState(data.match);
      }
    } catch (err) {
      console.warn('Poll error:', err.message);
    }
  }, 3000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

// ─── Show matched partner ─────────────────────────────────────────────────────
function showMatchedState(match) {
  const user   = Auth.getUser();
  const isInterviewer = match.role === 'interviewer';
  const pName  = isInterviewer ? match.interviewee_name : match.interviewer_name;
  const pRole  = isInterviewer ? 'Interviewee this round' : 'Interviewer this round';

  partnerAvatar.textContent = initials(pName);
  partnerName.textContent   = pName || 'Your partner';
  partnerRole.textContent   = pRole;
  showState('state-matched');
}

// ─── Session view ─────────────────────────────────────────────────────────────
function renderSession(match) {
  const isInterviewer = match.role === 'interviewer';
  const user          = Auth.getUser();
  const pName         = isInterviewer ? match.interviewee_name : match.interviewer_name;

  // Path — just one round in this version
  roundPath.innerHTML = '';
  const stone = document.createElement('div');
  stone.className = 'path-stone is-active';
  roundPath.appendChild(stone);

  roundLabel.textContent = 'Round 1 of 1';

  if (isInterviewer) {
    roundAsker.textContent    = `You are asking ${pName}`;
    roundQuestion.textContent = match.question_text || '';

    // Show rubric for interviewer
    const rubricList = (match.rubric || []).map(r => `<li>${r.criterion}</li>`).join('');
    const rubricEl   = document.createElement('div');
    rubricEl.style   = 'margin-top: 1rem; font-size: 0.875rem; color: var(--mist);';
    rubricEl.innerHTML = rubricList
      ? `<strong style="color:var(--ink-soft); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em;">Rubric</strong><ul style="margin:0.5rem 0 0; padding-left:1.2rem;">${rubricList}</ul>`
      : '';
    document.querySelector('.round-question-card')?.appendChild(rubricEl);

    nextRoundBtn.textContent = 'Waiting for answer…';
    nextRoundBtn.disabled    = true;

    // Poll for the match to complete
    const completePoll = setInterval(async () => {
      try {
        const updated = await RouletteAPI.getMatch(matchId);
        if (updated.match.status === 'completed') {
          clearInterval(completePoll);
          nextRoundBtn.textContent = 'View result →';
          nextRoundBtn.disabled    = false;
          nextRoundBtn.onclick     = () => showState('state-done');
        }
      } catch {}
    }, 4000);

  } else {
    // Interviewee view
    roundAsker.textContent    = `${pName} is interviewing you`;
    roundQuestion.textContent = match.question_text || '';

    // Add answer textarea
    const answerEl      = document.createElement('textarea');
    answerEl.id         = 'roulette-answer';
    answerEl.className  = 'answer-textarea';
    answerEl.placeholder = 'Type your answer here…';
    answerEl.style       = 'width:100%;min-height:160px;margin-top:1rem;padding:1rem;border:1px solid var(--mist-soft);border-radius:6px;font-family:var(--font-body);font-size:1rem;resize:vertical;';
    document.querySelector('.round-question-card')?.appendChild(answerEl);

    nextRoundBtn.textContent = 'Submit answer →';
    nextRoundBtn.onclick     = async () => {
      if (answerSubmitted) return;
      const text = answerEl.value.trim();
      if (!text) { answerEl.style.borderColor = 'var(--clay)'; return; }

      nextRoundBtn.disabled    = true;
      nextRoundBtn.textContent = 'Submitting…';
      answerSubmitted          = true;

      try {
        await RouletteAPI.submitAnswer(matchId, text);
        nextRoundBtn.textContent = 'Done! Finishing session…';
        setTimeout(() => showState('state-done'), 1200);
      } catch (err) {
        nextRoundBtn.disabled    = false;
        nextRoundBtn.textContent = 'Submit answer →';
        answerSubmitted          = false;
        console.error('Submit error:', err.message);
      }
    };
  }
}

// ─── Find a partner ───────────────────────────────────────────────────────────
async function startSearch() {
  answerSubmitted = false;
  matchId         = null;
  matchData       = null;
  showState('state-searching');

  try {
    const result = await RouletteAPI.join();

    if (result.status === 'matched') {
      // Matched instantly
      matchId   = result.match.id;
      matchData = result.match;
      showMatchedState(result.match);
    } else {
      // Waiting — poll for a partner
      startPolling();
    }
  } catch (err) {
    console.error('Join error:', err.message);
    showState('state-intro');
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────
findBtn.addEventListener('click', startSearch);

againBtn.addEventListener('click', startSearch);

cancelBtn.addEventListener('click', async () => {
  stopPolling();
  try { await RouletteAPI.leave(); } catch {}
  showState('state-intro');
});

startSessionBtn.addEventListener('click', async () => {
  // Fetch full match details (includes rubric + question text)
  try {
    if (!matchId) return;
    const data = await RouletteAPI.getMatch(matchId);
    matchData  = data.match;
    renderSession(matchData);
    showState('state-session');
  } catch (err) {
    console.error('Could not load match:', err.message);
  }
});
