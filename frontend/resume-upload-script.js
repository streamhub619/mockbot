// resume-upload.html — replace the existing <script>...</script> block with this
// Also add <script src="api.js"></script> BEFORE this script tag
// Change the "Generate my questions" element from <a> to <button type="button" id="continue-btn" ...>

requireAuth();
renderUserName();

document.querySelectorAll('.js-logout').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
});

const dropzone     = document.getElementById('dropzone');
const resumeInput  = document.getElementById('resume-input');
const dropzoneEmpty = document.getElementById('dropzone-empty');
const fileSelected = document.getElementById('file-selected');
const fileName     = document.getElementById('file-name');
const fileSize     = document.getElementById('file-size');
const fileRemove   = document.getElementById('file-remove');
const continueBtn  = document.getElementById('continue-btn');
const gentleHint   = document.getElementById('gentle-hint');
const jobDesc      = document.getElementById('job-description');
const targetRole   = document.getElementById('target-role');

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showFile(file) {
  fileName.textContent = file.name;
  fileSize.textContent = formatSize(file.size);
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

resumeInput.addEventListener('change', () => {
  if (resumeInput.files.length) showFile(resumeInput.files[0]);
});

fileRemove.addEventListener('click', (e) => { e.preventDefault(); clearFile(); });

dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
dropzone.addEventListener('dragleave', ()  => { dropzone.classList.remove('is-dragover'); });
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-dragover');
  if (e.dataTransfer.files.length) {
    resumeInput.files = e.dataTransfer.files;
    showFile(e.dataTransfer.files[0]);
  }
});

// ─── Submit — upload resume + JD, create session, navigate ───────────────────
continueBtn.addEventListener('click', async () => {
  if (!resumeInput.files.length) {
    gentleHint.style.display = 'block';
    return;
  }

  const jdText = jobDesc?.value?.trim() || '';
  if (!jdText || jdText.length < 50) {
    // Reuse gentle-hint pattern for JD
    gentleHint.textContent  = 'Paste a job description so we can tailor your questions.';
    gentleHint.style.display = 'block';
    return;
  }

  continueBtn.disabled     = true;
  continueBtn.textContent  = 'Uploading…';
  gentleHint.style.display = 'none';

  try {
    // 1 — Upload resume
    const resumeData = await ResumeAPI.upload(resumeInput.files[0]);
    const resumeId   = resumeData.resume.id;

    // 2 — Save job description
    continueBtn.textContent = 'Analysing…';
    const role   = targetRole?.value?.trim() || '';
    const jdData = await JobDescriptionAPI.create(jdText, role);
    const jdId   = jdData.jobDescription.id;

    // 3 — Create interview session (backend selects tailored questions)
    continueBtn.textContent = 'Building your session…';
    const sessionData = await SessionAPI.create(resumeId, jdId);
    const sessionId   = sessionData.session.id;

    // 4 — Stash session ID and navigate
    Store.set('session_id', sessionId);
    window.location.href = 'interview-session.html';

  } catch (err) {
    gentleHint.textContent   = err.message || 'Something went wrong. Please try again.';
    gentleHint.style.display = 'block';
    continueBtn.disabled     = false;
    continueBtn.textContent  = 'Generate my questions';
  }
});
