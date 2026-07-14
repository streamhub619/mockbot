// interview-session.html — replace the existing <script>...</script> block with this
// Also add <script src="api.js"></script> BEFORE this script tag

requireAuth();

const questionText    = document.getElementById('question-text');
const questionCounter = document.getElementById('question-counter');
const answerInput     = document.getElementById('answer-input');
const prevBtn         = document.getElementById('prev-btn');
const nextBtn         = document.getElementById('next-btn');
const sessionTimer    = document.getElementById('session-timer');
const questionPath    = document.getElementById('question-path');

let questions    = [];   // [{id, text, type, category, difficulty, hint}, ...]
let answers      = [];   // parallel array of answer strings
let currentIndex = 0;
let sessionId    = null;
let seconds      = 0;
let submitting   = false;

// ─── Load session from backend ────────────────────────────────────────────────
async function init() {
  sessionId = Store.get('session_id');
  if (!sessionId) {
    window.location.href = 'resume-upload.html';
    return;
  }

  try {
    const data = await SessionAPI.get(sessionId);
    questions   = data.session.questions || [];
    answers     = new Array(questions.length).fill('');

    // Pre-fill any answers already submitted (e.g. if user refreshed)
    (data.session.answers || []).forEach(a => {
      const idx = questions.findIndex(q => q.id === a.question_id);
      if (idx >= 0) answers[idx] = '(already submitted)';
    });

    renderQuestion();
    startTimer();
  } catch (err) {
    console.error('Failed to load session:', err.message);
    window.location.href = 'resume-upload.html';
  }
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

function startTimer() {
  setInterval(() => {
    seconds++;
    sessionTimer.textContent = 'session time · ' + formatTime(seconds);
  }, 1000);
}

// ─── Path bar ─────────────────────────────────────────────────────────────────
function renderPath() {
  questionPath.innerHTML = '';
  questions.forEach((_, i) => {
    const stone = document.createElement('div');
    stone.className = 'path-stone';
    if (i === currentIndex)           stone.classList.add('is-active');
    else if (answers[i].trim() !== '') stone.classList.add('is-done');
    questionPath.appendChild(stone);
    if (i < questions.length - 1) {
      const line = document.createElement('div');
      line.className = 'path-line';
      questionPath.appendChild(line);
    }
  });
}

// ─── Render current question ──────────────────────────────────────────────────
function renderQuestion() {
  const q = questions[currentIndex];
  questionText.textContent    = q.text;
  questionCounter.textContent = `Question ${currentIndex + 1} of ${questions.length}`;
  answerInput.value           = answers[currentIndex];
  answerInput.disabled        = answers[currentIndex] === '(already submitted)';
  prevBtn.style.visibility    = currentIndex === 0 ? 'hidden' : 'visible';
  nextBtn.textContent         = currentIndex === questions.length - 1
    ? 'Finish session'
    : 'Next question →';
  renderPath();
}

function saveCurrent() {
  answers[currentIndex] = answerInput.value;
}

// ─── Submit a single answer ───────────────────────────────────────────────────
async function submitCurrentAnswer() {
  const q    = questions[currentIndex];
  const text = answerInput.value.trim();
  if (!text || text === '(already submitted)') return;

  try {
    await AnswerAPI.submit(sessionId, q.id, text);
  } catch (err) {
    // Non-blocking — we still advance the user
    console.warn('Answer submit error:', err.message);
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────
prevBtn.addEventListener('click', () => {
  saveCurrent();
  if (currentIndex > 0) { currentIndex--; renderQuestion(); }
});

nextBtn.addEventListener('click', async () => {
  if (submitting) return;
  saveCurrent();
  submitting      = true;
  nextBtn.disabled = true;
  nextBtn.textContent = currentIndex === questions.length - 1 ? 'Finishing…' : 'Saving…';

  await submitCurrentAnswer();

  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
    nextBtn.disabled = false;
    submitting       = false;
  } else {
    // All done — complete the session and go to feedback
    try {
      await SessionAPI.complete(sessionId);
    } catch (err) {
      console.warn('Complete session error:', err.message);
    }
    // session_id already in Store — feedback.html will read it
    window.location.href = 'feedback.html';
  }
});

init();
