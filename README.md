# glasstilapia-cssprint-2026

Team glasstilapia's CSSprint 2026 hackathon project.

> **Start with [`CLAUDE.md`](CLAUDE.md).** It has the project brief, who owns
> what, conventions, and the decisions log.

## Quick start

You need **Python 3.11+**, **Node.js 18+**, and **Git**.

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Check http://localhost:8000/docs. You should see the interactive API page.

### 2. Frontend (React + Vite)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. It should say **Backend: ok**, and adding an item
should make it appear in the list. If you see "backend unreachable," the
backend from step 1 isn't running.

### 3. Tests

```bash
cd backend && pytest
cd frontend && npm run build
```

GitHub runs both automatically on every pull request.

## Layout

```
backend/
  app/main.py          FastAPI app + route registration
  app/routes/items.py  example resource (copy this for new features)
  tests/               pytest tests
frontend/
  src/App.tsx          main screen
  src/api.ts           every backend call + shared types
  vite.config.ts       proxies /api → backend
```

## Working with Claude (`@claude`)

Only one of us has a Claude account, so Claude is shared through GitHub:

- **In an issue or PR comment**, write `@claude` followed by a specific request,
  e.g. `@claude add a POST /api/scores endpoint that stores a name and score,
  with a test`. Claude replies in the thread and pushes a branch or PR you can
  review.
- Use the **"Ask Claude"** issue template for bigger requests.
- It uses one person's usage, so save it for real blockers, boilerplate, and
  reviews. Don't use it for things you can do in five minutes.
- **Always review what Claude pushes** before merging. You own the code.

Quick questions can also go in Discord `#ask-claude`.
