# DataReady — transaction data validation & data-readiness workbench

A single web app that covers the whole **Xeno Implementation Internship** brief:

- **Validator (Part 4 — AI Empowerment):** upload a transaction **CSV or Excel
  (.xlsx/.xls)** file (Excel date serials are converted; SheetJS is lazy-loaded) → validate
  phone numbers against **configurable, country-code-driven rules** (Singapore 8
  digits, India 10 digits, …), check dates against **configurable accepted
  formats**, run **integrity checks** (required fields, numeric amounts, email
  format, allowed payment modes, duplicate order IDs) → see results as **charts**
  (pass-rate donut + issue breakdown) and a highlighted table → download a
  **cleaned CSV** and an **errors report**, and **auto-split large files into
  chunks** bundled as one `.zip`. A ready-made
  [`sample-transactions.csv`](public/sample-transactions.csv) (30 rows exercising
  every rule) loads via **Sample**; a **5k stress** button generates 5,000 rows.
  The results table renders at most 100 rows at a time (opt into "show all"), so
  large files stay responsive.
- **SQL Workbench (Parts 1–3):** a sample `customers` table (160 rows) and an
  `orders` table run inside an in-browser **SQLite (WASM)** engine. Every
  required query is shown in its canonical **MySQL** form *and* executed **live**
  to produce a real result table, with charts for the aggregate questions.

Validation, cleaning, chunking, and SQL all run **client-side** — transaction
data never leaves the browser tab. The only server-side piece is the optional AI
layer (below), which is a thin proxy so the Claude API key stays secret.

## AI features (optional)

Two places call **Claude** (`claude-opus-4-8` via the official Anthropic SDK)
through a small serverless function at `/api/ai`, so the API key stays
server-side and never reaches the browser:

- **SQL Workbench → "Ask in plain English"** — type a question, the model writes
  a read-only SQLite query (guarded client-side to SELECT-only), and it runs live
  against the sample data.
- **Validator → "Auto-map with AI"** — maps messy / non-English / unconventional
  CSV headers to the validator's roles from the headers + a few sample rows
  (e.g. German `Bestell-Nr → id`, `Zahlungsart → payment`).
- **Validator → "Explain & fix"** — turns the validation report into a
  plain-English data-quality briefing with a prioritized fix list.

**No key? The app still works fully** — those two buttons just show a "not
configured" notice. To enable AI, set `ANTHROPIC_API_KEY`:

- Local dev: copy `.env.example` → `.env.local` and add the key (Vite's dev
  middleware serves `/api/ai`).
- Vercel: add `ANTHROPIC_API_KEY` as a project env var (the `api/` function is
  auto-detected). Optional overrides: `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`.

## Run locally

```bash
cd data-platform
npm install
npm run dev      # http://localhost:5174
```

`npm run build` produces a static `dist/` you can drop on any host.

## Deploy (publicly accessible URL for the submission form)

Static SPA — works on Vercel, Netlify, Cloudflare Pages or GitHub Pages.

**Vercel:** import the repo, set **Root Directory** to `data-platform/`.
Build command `npm run build`, output dir `dist/`. `vercel.json` already adds
the SPA rewrite. Done.

## How it works (Part 4 approach — 3 lines)

Pure client-side validation keeps sensitive transaction data in the browser and
makes hosting free; phone/date/integrity rules are **data, not code** (editable
country rules, accepted date formats, and allowed payment modes), so the same
engine adapts to any country or format without code changes. Cleaning normalises
in place (E.164-ish phones, ISO dates, lower-cased emails) and chunking is done
with JSZip into one downloadable archive. **Not built (conscious scope):** server
persistence, auth, and streaming for files in the hundreds-of-MB range — the
chunker is the seam where a worker/stream implementation would slot in.

## Layout

```
src/
  lib/
    countryRules.js     configurable country phone rules + validator
    dateRules.js        format-driven date/time validator (no date lib)
    validateDataset.js  column auto-detection + per-row/per-dataset engine
    csv.js              parse / build / errors report / chunk-to-zip
    sampleData.js       deterministic customers + messy transactions samples
    db.js               sql.js (SQLite WASM) loader + MySQL-style functions
    queries.js          the Part 1–3 question bank (MySQL answer + live SQLite)
    ai.js               client for /api/ai (text-to-SQL, summarize) + SELECT guard
  pages/                Overview · Validator · SqlWorkbench
  components/ResultTable.jsx
api/
  handler.js            shared AI handler — Anthropic SDK, key kept server-side
  ai.js                 Vercel serverless entry (POST /api/ai)
```

## Notes on the SQL

The MySQL text in the workbench is the canonical answer for the PDF. The live
queries run in SQLite and differ only where the dialects do:
`DATE_SUB(d, INTERVAL n DAY)` → `DATE(d,'-n day')`,
`SUBSTRING_INDEX(name,' ',1)` → `SUBSTR(name,1,INSTR(name||' ',' ')-1)`,
`DATE_FORMAT(d,'%Y-%m')` → `strftime('%Y-%m', d)`. `MONTHNAME`/`DAYNAME` are
registered as SQLite functions so those queries read identically. "Today" is
fixed to **2025-04-16** per the assignment.
