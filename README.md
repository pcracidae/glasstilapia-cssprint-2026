# glasstilapia-cssprint-2026

Team GlassTilapia's CSSprint 2026 hackathon project.

> Micro business owners who sell for cash every day can keep effortless,
> trustworthy records of their own business, so they can see their real profit
> today and get ready for a loan from a lender they choose.

## What we're building

A bookkeeping app that additionally focuses on the loan-readiness of a micro 
to small enterprise (sari-sari, karinderya, micro retail). It's a phone-first, 
free for owners, and available offline web app.

- **Ledger:** log sales, expenses and loans in a few taps; and see today's profit.
- **Trust tiers:** each entry is verified, matched to a statement, corroborated,
  or self-reported.
- **AI consultant:** checks the ledger or financial statement for improvements and
  for the analysis of the lender, and for a quick estimate of their borrowing capacity.
- **Consent-based sharing:** the owner shares a summary with one lender, with an
  expiry and a revoke button.

Stretch goals: AI-written store insights and voice logging.

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
