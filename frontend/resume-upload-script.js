requireAuth();
renderUserName();

document.querySelectorAll('.js-logout').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
});

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const dropzone      = document.getElementById('dropzone');
const resumeInput   = document.getElementById('resume-input');
const dropzoneEmpty = document.getElementById('dropzone-empty');
const fileSelected  = document.getElementById('file-selected');
const fileName      = document.getElementById('file-name');
const fileSize      = document.getElementById('file-size');
const fileRemove    = document.getElementById('file-remove');
const continueBtn   = document.getElementById('continue-btn');
const gentleHint    = document.getElementById('gentle-hint');
const jobDesc       = document.getElementById('job-description');
const targetRole    = document.getElementById('target-role');

// ─── Mode toggle ──────────────────────────────────────────────────────────────
let selectedMode = 'ai_tailored'; // default

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
  });
});

// ─── File handling ────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showFile(file) {
  fileName.textContent        = file.name;
  fileSize.textContent        = formatSize(file.size);
  dropzoneEmpty.style.display = 'none';
  fileSelected.style.display  = 'flex';
  dropzone.style.display      = 'none';
  gentleHint.style.display    = 'none';
}

function clearFile() {
  resumeInput.value           = '';
  dropzone.style.display      = 'block';
  dropzoneEmpty.style.display = 'block';
  fileSelected.style.display  = 'none';
}

function showHint(message) {
  gentleHint.textContent   = message;
  gentleHint.style.display = 'block';
}

resumeInput.addEventListener('change', () => {
  if (resumeInput.files.length) showFile(resumeInput.files[0]);
});

fileRemove.addEventListener('click', (e) => { e.preventDefault(); clearFile(); });

dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('is-dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-dragover');
  if (e.dataTransfer.files.length) {
    resumeInput.files = e.dataTransfer.files;
    showFile(e.dataTransfer.files[0]);
  }
});

// ─── Submit ───────────────────────────────────────────────────────────────────
continueBtn.addEventListener('click', async () => {
  gentleHint.style.display = 'none';

  if (!resumeInput.files.length) {
    showHint('Add your resume above so we can tailor the questions to you.');
    return;
  }

  const jdText = jobDesc?.value?.trim() || '';
  if (!jdText || jdText.length < 50) {
    showHint('Paste a job description so we can tailor your questions.');
    return;
  }

  continueBtn.disabled    = true;
  continueBtn.textContent = 'Uploading…';

  try {
    // 1 — Upload resume
    const resumeData = await ResumeAPI.upload(resumeInput.files[0]);
    const resumeId   = resumeData.resume.id;

    // 2 — Save job description
    continueBtn.textContent = 'Saving job description…';
    const role   = targetRole?.value?.trim() || '';
    const jdData = await JobDescriptionAPI.create(jdText, role);
    const jdId   = jdData.jobDescription.id;

    // 3 — Create session with the selected mode
    continueBtn.textContent = selectedMode === 'ai_tailored'
      ? 'AI is generating your questions…'
      : 'Building your session…';

    const sessionData = await SessionAPI.create(resumeId, jdId, selectedMode);
    const sessionId   = sessionData.session.id;

    // 4 — Store session info and navigate
    Store.set('session_id', sessionId);
    Store.set('session_mode', selectedMode);
    window.location.href = 'interview-session.html';

  } catch (err) {
    showHint(err.message || 'Something went wrong. Please try again.');
    continueBtn.disabled    = false;
    continueBtn.textContent = 'Generate my questions';
  }
});
