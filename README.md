# LedgeLoan

**From notebook to loan-ready.**

Team GlassTilapia · CSSprint 2026

LedgeLoan is a phone-first web app for micro businesses that sell for cash
every day, like sari-sari stores, carinderias and market stalls. Owners log
sales, expenses and utang in a few taps, see their real profit today, and
build a record a lender can trust. When they're ready, they share that record
with one lender they choose, for a set time, and can stop it any time.

## The problem

Banks and other formal lenders rarely lend to micro businesses because they
have no records. Micro firms are 90.4% of Philippine MSMEs ([DTI 2023](https://dti.gov.ph/businesses/msmes/msmeresources/msme-statistics)),
yet banks lend only about 1.9% of their loan book to micro and small
enterprises. Owners end up with 5-6 lending at about 20% a month.

## What's in the app

The demo runs as **Aling Nena**, who has a sari-sari store in Quezon City.
She started LedgeLoan 7 days ago and copied her older days in from her
notebook.

| Screen | What you can do |
| --- | --- |
| **Sign in** | Splash, choose English or Tagalog, sign up by phone or email, enter the 6-digit code, create a 4-digit PIN. Next time, unlock with the PIN. |
| **Today** | Today's profit (cash in and out), who owes you and whom you owe, loan readiness, the latest entries and what to do next. Swipe the card or tap the dots. Tap **N** for the profile panel (Sharing, Privacy, Export, Lock, Reset demo). |
| **Transactions** | Every entry by day with each day's profit, and a bar showing how much income is verified, corroborated or self-reported. Tap an entry to see details or void it. Works offline: entries are saved on the phone and marked synced when the signal returns. |
| **New entry** (＋ on Transactions) | Sales (sale, **utang** on credit, payment in), purchases (paid, on credit, payment out) or others (expense, other income), with an optional contact, description, item breakdown and date. |
| **Contacts** | Customers who owe the store and suppliers the store owes, with how old each balance is and a polite reminder the owner copies and sends themselves. |
| **Loan** | Days logged on time, verified income and steady sales, then programs ranked by cost to the owner (SB Corp P3, a cooperative, a microfinance group loan), each with terms, eligibility and a papers checklist. No document uploads. |
| **Sharing** | Pick a lender, purpose, date range and how long the link works, choose what's included, get a link, see how many times it was opened, and stop it. Lenders never see customer names or notes. |
| **Lender statement** | The link opens a Statement of Business Records: income on a cash basis, evidence behind the income, monthly summary, money owed by age, record completeness, and a CSV of entries. |

### Demo script (about 2 minutes)

1. Open the app, pick a language, tap **Send code**, enter **482913**, and set any 4-digit PIN.
2. **Today:** ₱1,240 profit today. Swipe to see ₱1,240 owed by 4 customers, then 23 days to P3-ready.
3. **Transactions → ＋:** log a ₱120 utang for Mang Ben. It shows up in Contacts.
4. **Loan → Microfinance group loan → Proceed with application.**
5. Tick what to include, tap **Share**, then **Open the lender's view** to see the statement. Back on **Sharing**, the view count went up; tap **Stop** and reload the lender tab.

Tip: in Chrome, open DevTools (F12), press Ctrl+Shift+M and pick a phone
such as iPhone 14 Pro. Use **Reset demo data** in the profile panel to start over.

## Run it

You need **Node.js 18+**. The app runs entirely in the browser; no backend is
needed for the demo.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into frontend/dist
```

The FastAPI backend in `backend/` is optional for now (it has a health check
and an example resource). To run it and its tests:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000/docs
pytest
```

## How it works

- **Stack:** React 18 + TypeScript + Vite. No extra libraries.
- **Data:** the ledger lives in the browser (`localStorage`), so the app works
  offline. Aling Nena's sample ledger is generated the same way on every load
  and dated relative to today. Entries you add, voids and share links are kept
  on your device.
- **Trust tiers:** every entry is Verified (QR Ph payment), Matched (imported
  e-wallet or supplier record), Corroborated (cash that matches deposits) or
  Self-reported. Entries made more than 2 days after their date are labelled
  late and don't count toward days logged on time.
- **Sharing:** links carry a random token and open the statement in the same
  browser for the demo. The server version (random tokens stored as hashes,
  view log, CSV export) is in pull request #5 and is the next step.

```
frontend/src/
  data.ts            ledger types, sample data, storage and every calculation
  App.tsx            sign-in gate, tabs and navigation
  screens/           SignIn, Overview, Transactions, NewEntry, Contacts, Loan, Share, Statement
  ui.tsx, icons.tsx  shared rows, badges, sheets and line icons
  index.css          design tokens from the Figma board
backend/             FastAPI (optional for the demo)
```

## Privacy and security

- No API keys, tokens or passwords are in this repository. Secrets go in
  `backend/.env`, which is git-ignored; `backend/.env.example` holds
  placeholders only.
- LedgeLoan never holds money, never sells data, and shares records only with
  the lender the owner picks.
- The sign-in code is a demo code: no SMS or email is sent yet.

## What's next

- Connect the app to the sharing backend (PR #5) so links work across devices.
- Real SMS or email codes, and a hashed PIN on the server.
- QR Ph payment confirmations to raise verified income.
- AI-written store insights and voice logging (stretch goals).

See [`CLAUDE.md`](CLAUDE.md) for team conventions and the decisions log.
