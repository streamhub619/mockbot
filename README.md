# MockBot — Interview Preparation Platform

A full-stack personalized technical interview simulator. Students upload their resume and a job description to get tailored interview questions, submit answers, and receive structured feedback. Includes a Mock Roulette peer-matching feature.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| File Upload | Multer (PDF/DOCX) |
| Text Extraction | pdf-parse, mammoth |
| AI (optional) | Google Gemini API |
| Frontend | Vanilla HTML / CSS / JavaScript |

---

## Project Structure

```
mockbot/
├── db/
│   ├── schema.sql           # All tables, indexes, triggers
│   ├── seed.sql             # Generic question bank, rubrics, skills list
│   ├── migration.sql        # ALTER TABLE for ai_tailored session type
│   └── setup.js             # Cross-platform DB setup script (replaces shell scripts)
├── frontend/
│   ├── design-system.css    # Global design tokens, components, path bar
│   ├── api.js               # Shared API layer — auth, fetch wrapper, store helpers
│   ├── index.html           # Login / register page
│   ├── login-script.js
│   ├── dashboard.html       # Main dashboard with stats and recent sessions
│   ├── dashboard-script.js
│   ├── resume-upload.html   # Session setup — resume upload, JD paste, mode toggle
│   ├── resume-upload-script.js
│   ├── interview-session.html  # Live question/answer interface
│   ├── interview-session-script.js
│   ├── feedback.html        # Post-session results with per-question breakdown
│   ├── feedback-script.js
│   ├── history.html         # Full session history with expandable detail
│   ├── history-script.js
│   ├── mock-roulette.html   # Peer matching and roulette session flow
│   ├── roulette-script.js
│   └── style-guide.html     # Design system reference (dev only, git-ignored)
├── src/
│   ├── index.js             # Express app entry point
│   ├── config/
│   │   └── db.js            # pg connection pool + transaction helper
│   ├── middleware/
│   │   ├── auth.js          # JWT generation and verification
│   │   ├── errorhandler.js  # Central Express error handler
│   │   └── upload.js        # Multer config — PDF/DOCX, 5 MB cap
│   ├── models/
│   │   ├── user.model.js
│   │   ├── resume.model.js
│   │   ├── jobdescription.model.js
│   │   ├── session.model.js
│   │   ├── answer.model.js
│   │   └── roulette.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── resume.routes.js
│   │   ├── jd.routes.js
│   │   ├── session.routes.js
│   │   ├── answer.routes.js
│   │   └── roulette.routes.js
│   └── utils/
│       ├── skillextractor.js    # Keyword-based skill detection from text
│       ├── evaluator.js         # Rule-based rubric evaluator (offline)
│       └── questiongenerator.js # Gemini-powered question generation (AI mode)
├── uploads/                 # Stored resume files — git-ignored
├── .env                     # Environment variables — git-ignored
├── .env.example             # Template for environment variables
├── .gitignore
└── package.json
```

---

## Quick Start

### 1 — Prerequisites
- Node.js ≥ 18
- PostgreSQL 14+

### 2 — Install dependencies
```bash
npm install
```

### 3 — Configure environment
```bash
cp .env.example .env
# Fill in your PostgreSQL credentials and optional API keys
```

### 4 — Create the database and run setup
```bash
# Create the database (first time only)
psql -U postgres -h localhost -c "CREATE DATABASE mockbot_db;"

# Run schema and seed data
npm run db:init
npm run db:seed

# If you are adding AI mode for the first time, also run:
psql -U postgres -d mockbot_db -f db/migration.sql
```

### 5 — Start the backend server
```bash
npm run dev     # development with auto-reload on port 5000
npm start       # production
```

### 6 — Open the frontend
Open `frontend/index.html` in your browser directly, or serve it with VS Code Live Server (recommended — avoids CORS `null` origin issues).

The backend API runs on `http://localhost:5000`. The `API_BASE` constant in `frontend/api.js` points there by default.

---

## Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# PostgreSQL — use DATABASE_URL or individual vars
DATABASE_URL=postgresql://postgres:password@localhost:5432/mockbot_db

DB_HOST=localhost
DB_PORT=5432
DB_NAME=mockbot_db
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d

# File uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=5

# AI features (optional — app works without these using rule-based fallback)
GEMINI_API_KEY=your_gemini_api_key

# CORS — set this if your frontend is served from a non-default port
FRONTEND_URL=http://localhost:5500
```

---

## Frontend Pages

| Page | File | Description |
|---|---|---|
| Login / Register | `index.html` | Auth form — switches between login and register mode |
| Dashboard | `dashboard.html` | Stats overview and recent sessions list |
| Set Up Session | `resume-upload.html` | Resume upload, job description paste, AI/Rules mode toggle |
| Interview | `interview-session.html` | Question-by-question answer interface with session timer |
| Feedback | `feedback.html` | Per-question results with score, strengths, and missed concepts |
| History | `history.html` | All past sessions — click to expand full Q&A breakdown |
| Mock Roulette | `mock-roulette.html` | Peer matching and live interview loop |

### Frontend data flow

```
index.html          → POST /api/auth/login|register  → JWT stored in localStorage
resume-upload.html  → POST /api/resumes              → resumeId
                    → POST /api/job-descriptions     → jdId
                    → POST /api/sessions             → sessionId → sessionStorage
interview-session   → GET  /api/sessions/:id         → loads questions
                    → POST /api/answers (each Q)     → evaluated and stored
                    → PATCH /api/sessions/:id/complete
feedback.html       → GET  /api/sessions/:id         → reads answers and verdicts
dashboard.html      → GET  /api/sessions             → recent sessions list
                    → GET  /api/sessions/history/stats
history.html        → GET  /api/sessions             → all sessions
                    → GET  /api/sessions/:id         → per-session detail on expand
mock-roulette.html  → POST /api/roulette/join        → matchId
                    → GET  /api/roulette/match (poll every 3s)
                    → GET  /api/roulette/matches/:id
                    → POST /api/roulette/matches/:id/submit
```

### Shared frontend modules

**`api.js`** — loaded on every page before page-specific scripts. Provides:
- `Auth` — token storage, login/logout, `isLoggedIn()`
- `apiFetch()` — authenticated fetch wrapper, auto-redirects on 401
- `AuthAPI`, `ResumeAPI`, `JobDescriptionAPI`, `SessionAPI`, `AnswerAPI`, `RouletteAPI`
- `requireAuth()` — page guard, redirects to `index.html` if not logged in
- `renderUserName()` — fills `.js-user-name` spans with the logged-in user's first name
- `Store` — `sessionStorage` helpers for passing data between pages (e.g. `session_id`)

---

## Session Modes

The resume upload page offers two modes selectable via a toggle:

### AI Mode (`ai_tailored`)
- Gemini reads the full resume text and job description
- Generates 5 technical + 2 behavioral questions tailored to the exact role
- Answers are evaluated by Gemini with natural-language feedback
- Requires `GEMINI_API_KEY` in `.env`

### Rules Mode (`resume_tailored`)
- Extracts skills from the resume and job description using keyword matching
- Selects questions from the seeded question bank whose category best matches the skill intersection
- Answers are scored by the rubric evaluator — checks for signal keywords against stored rubric criteria
- Works fully offline, no API key required

If `GEMINI_API_KEY` is not set and AI mode is selected, the backend returns a clear error and the frontend displays it before any upload is attempted.

---

## Evaluation Engine

### Rule-based evaluator (`src/utils/evaluator.js`)
Used for `resume_tailored` and `quick` sessions.

1. Fetches rubric criteria for the question from the `rubrics` table
2. Checks whether the candidate's answer contains the signal keywords for each criterion
3. Computes a weighted score (0–10)
4. Returns `strengths`, `missed`, `improvements`, `logic_check`, and `overall_feedback`

### Gemini evaluator (`src/routes/answer.routes.js`)
Used for `ai_tailored` sessions when `GEMINI_API_KEY` is set.

- Sends the question, expected concepts, and candidate answer to Gemini
- Parses the structured JSON response for score, verdict, strengths, missed, and feedback
- Falls back to the rule-based evaluator if the Gemini response is unparseable

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current authenticated user |

### Resumes
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/resumes` | Upload PDF/DOCX — extracts text and parses skills |
| GET | `/api/resumes` | List user's resumes |
| GET | `/api/resumes/:id` | Get single resume |
| DELETE | `/api/resumes/:id` | Delete resume and file |

### Job Descriptions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/job-descriptions` | Submit job description — parses required skills |
| GET | `/api/job-descriptions` | List user's job descriptions |
| GET | `/api/job-descriptions/:id` | Get single job description |
| DELETE | `/api/job-descriptions/:id` | Delete job description |

### Sessions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sessions` | Create session (`resume_tailored`, `ai_tailored`, or `quick`) |
| GET | `/api/sessions` | List all sessions for current user |
| GET | `/api/sessions/history/stats` | Dashboard stats (must be before `/:id` route) |
| GET | `/api/sessions/:id` | Full session with questions and answers |
| PATCH | `/api/sessions/:id/complete` | Mark complete — calculates average score |
| PATCH | `/api/sessions/:id/abandon` | Abandon active session |

### Answers
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/answers` | Submit answer — evaluates and stores result |
| GET | `/api/answers/session/:sessionId` | All answers for a session |
| GET | `/api/answers/history` | Recent answer history across all sessions |

### Mock Roulette
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/roulette/join` | Join waiting pool — auto-matches if partner available |
| DELETE | `/api/roulette/leave` | Leave the waiting pool |
| GET | `/api/roulette/match` | Poll for match status (call every 3s while waiting) |
| GET | `/api/roulette/matches/:id` | Full match details — question and rubric |
| POST | `/api/roulette/matches/:id/submit` | Interviewee submits answer |

### Health
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server and database status check |

---

## Database Management

```bash
npm run db:init    # Create all tables and indexes from schema.sql
npm run db:seed    # Insert generic question bank and skills list
npm run db:reset   # Drop and recreate database, then re-init and re-seed
```

For AI mode (run once after pulling the ai_tailored feature):
```bash
psql -U postgres -d mockbot_db -f db/migration.sql
```

---

## Key Implementation Notes

- **CORS**: configured to allow `localhost:3000`, `localhost:5500`, `127.0.0.1:5500`, `localhost:8080`, and `null` (for `file://` direct open). Add your port to the `ALLOWED_ORIGINS` array in `src/index.js` if needed.
- **pdf-parse**: required lazily inside the extraction function, not at the top of the file — top-level require causes a "not a function" error.
- **Session route ordering**: `GET /api/sessions/history/stats` must be registered before `GET /api/sessions/:id` or Express captures it as `id = "history"`.
- **Session questions insert**: uses fully parameterized queries — question IDs are passed as parameters, not interpolated into SQL strings.
- **SSL**: only enabled for `DATABASE_URL` connections when `NODE_ENV=production`. Local development uses no SSL.
- **Logout links**: use a single `class="btn btn-quiet js-logout"` attribute — two separate `class` attributes on the same element means only the first is read by the browser.