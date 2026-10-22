# CLAUDE.md — project brief

Read this first. It's for Claude **and** for every teammate. If you make a
decision, add a line to the Decisions log at the bottom.

## The project

- **Event:** CSSprint 2026 hackathon (3 days)
- **Problem statement:** _TBD — paste it here as soon as it's announced._
- **One-sentence pitch:** _TBD — "[Who] can [do what] so that [why it matters]."_
- **Core demo (what judges see on screen):**
  1. _TBD_
  2. _TBD_
  3. _TBD_
- **Stretch goals (only after the core demo works):** _TBD_

## Team & ownership

| Person | Owns | Notes |
| ------ | ---- | ----- |
| pcracidae | Setup, Claude requests (`#ask-claude`), _TBD_ | Only Claude account |
| _TBD_ | Backend / API | |
| _TBD_ | Frontend / UI | |
| _TBD_ | Pitch, design, glue, demo | Floats where needed |

## Stack

- **Backend:** Python 3.11+, FastAPI, Pydantic, Uvicorn (`backend/`)
- **Frontend:** React 18 + TypeScript, built with Vite (`frontend/`)
- **Dev wiring:** Vite proxies `/api/*` → `http://localhost:8000`, so the
  frontend just calls `fetch("/api/...")`. All API calls live in
  `frontend/src/api.ts`.
- **Data:** in-memory for now. Add SQLite only if the demo needs it.

## Commands

```bash
# Backend (terminal 1)
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload      # http://localhost:8000/docs
pytest                             # run tests

# Frontend (terminal 2)
cd frontend
npm install
npm run dev                        # http://localhost:5173
npm run build                      # type-check + production build
```

## Conventions

- New backend feature = new file in `backend/app/routes/`, registered in
  `app/main.py`. Copy `items.py` as a template.
- Every endpoint is under `/api/...`. Request/response bodies are Pydantic
  models; mirror them as TypeScript types in `frontend/src/api.ts`.
- Keep components small; put them in `frontend/src/components/` once there
  are more than a couple.
- Branch per task (`feat/short-name`), small PRs, merge into `main` often.
  `main` must always run.
- Secrets go in `backend/.env` (copied from `.env.example`). Never commit keys.
- Prefer boring, working code over clever code. It's a 3-day hackathon.

## Notes for Claude

- Match the existing structure; don't add frameworks, state libraries, or
  build tooling without being asked.
- When you add an endpoint, update `frontend/src/api.ts` and add a test in
  `backend/tests/`.
- Keep PRs focused on the one request and explain in plain language what
  changed and how to try it. Teammates may not have Claude to ask.

## Decisions log

_Newest first. One line each: date — decision — why (— who)._

- 2026-10-22 — Python (FastAPI) backend + React (Vite, TypeScript) frontend — team choice; TS types feel familiar coming from Java — pcracidae
