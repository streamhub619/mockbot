# MockBot — Backend API

**Sprint 2 Deliverable:** Database development & backend setup.

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| File Upload | Multer (PDF/DOCX) |
| Text Extraction | pdf-parse, mammoth |

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
# Edit .env with your PostgreSQL credentials
```

### 4 — Create the database
```bash
psql -U postgres -c "CREATE DATABASE mockbot_db;"
```

### 5 — Run migrations and seed data
```bash
npm run db:init    # creates all tables and indexes
npm run db:seed    # inserts generic question bank and skills list
```

### 6 — Start the server
```bash
npm run dev        # development with auto-reload
npm start          # production
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/auth/me` | Current user info |

### Resumes
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/resumes` | Upload PDF/DOCX — auto-parses skills |
| GET | `/api/resumes` | List user's resumes |
| GET | `/api/resumes/:id` | Get single resume |
| DELETE | `/api/resumes/:id` | Delete resume |

### Job Descriptions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/job-descriptions` | Submit job description — auto-parses required skills |
| GET | `/api/job-descriptions` | List user's JDs |
| GET | `/api/job-descriptions/:id` | Get single JD |
| DELETE | `/api/job-descriptions/:id` | Delete JD |

### Sessions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sessions` | Start a new session (`resume_tailored` or `quick`) |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Full session with questions and answers |
| PATCH | `/api/sessions/:id/complete` | Mark session complete (calculates final score) |
| PATCH | `/api/sessions/:id/abandon` | Abandon session |
| GET | `/api/sessions/history/stats` | Dashboard stats |

### Answers
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/answers` | Submit answer — evaluates and stores result |
| GET | `/api/answers/session/:sessionId` | All answers for a session |
| GET | `/api/answers/history` | Recent answer history |

### Mock Roulette
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/roulette/join` | Join waiting pool (auto-matches if partner found) |
| DELETE | `/api/roulette/leave` | Leave waiting pool |
| GET | `/api/roulette/match` | Poll for match status |
| GET | `/api/roulette/matches/:id` | Full match details + question + rubric |
| POST | `/api/roulette/matches/:id/submit` | Interviewee submits answer |

---

## Evaluation Engine

Answers are evaluated by the **rule-based evaluator** (`src/utils/evaluator.js`) by default — fully offline, no API key needed:

1. Fetch rubric criteria for the question from the database.
2. Check whether the candidate's answer contains signal keywords for each criterion.
3. Compute a weighted score (0–10).
4. Return `strengths`, `missed`, `improvements`, `logic_check`, and `overall_feedback`.

**Optional AI upgrade:** Set `ANTHROPIC_API_KEY` in `.env` to route answer evaluation through Claude for richer, natural-language feedback. The rule-based engine is the fallback if the AI call fails.

---

## Database Reset
```bash
npm run db:reset   # drops all tables, recreates schema, re-seeds
```

---

## Project Structure
```
mockbot-backend/
├── db/
│   ├── schema.sql       # All tables, indexes, triggers
│   └── seed.sql         # Generic questions, rubrics, skills list
├── src/
│   ├── index.js         # Express app entry point
│   ├── config/
│   │   └── database.js  # pg Pool + transaction helper
│   ├── middleware/
│   │   ├── auth.js      # JWT generation & verification
│   │   ├── errorHandler.js
│   │   └── upload.js    # Multer (PDF/DOCX, max 5 MB)
│   ├── models/          # All database queries (no ORM)
│   │   ├── user.model.js
│   │   ├── resume.model.js
│   │   ├── jobDescription.model.js
│   │   ├── session.model.js
│   │   ├── answer.model.js
│   │   └── roulette.model.js
│   ├── routes/          # Express routers
│   │   ├── auth.routes.js
│   │   ├── resume.routes.js
│   │   ├── jd.routes.js
│   │   ├── session.routes.js
│   │   ├── answer.routes.js
│   │   └── roulette.routes.js
│   └── utils/
│       ├── skillExtractor.js  # Keyword-based skill detection
│       └── evaluator.js       # Rule-based answer evaluation
└── uploads/             # Stored resume files (git-ignored)
```
