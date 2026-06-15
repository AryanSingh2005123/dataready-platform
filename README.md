# DataReady — transaction data validation & data-readiness workbench

A single web app that covers the whole **Xeno Implementation Internship** brief:

- **Validator (Part 4 — AI Empowerment):** upload a transaction CSV → validate
  phone numbers against **configurable, country-code-driven rules** (Singapore 8
  digits, India 10 digits, …), check dates against **configurable accepted
  formats**, run **integrity checks** (required fields, numeric amounts, email
  format, allowed payment modes, duplicate order IDs) → download a **cleaned
  CSV** and an **errors report**, and **auto-split large files into chunks**
  bundled as one `.zip`.
- **SQL Workbench (Parts 1–3):** a sample `customers` table (160 rows) and an
  `orders` table run inside an in-browser **SQLite (WASM)** engine. Every
  required query is shown in its canonical **MySQL** form *and* executed **live**
  to produce a real result table, with charts for the aggregate questions.

Everything runs **client-side** — no backend, no upload. Transaction data never
leaves the browser tab, which also makes it free to host and trivial to deploy.

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
  pages/                Overview · Validator · SqlWorkbench
  components/ResultTable.jsx
```

## Notes on the SQL

The MySQL text in the workbench is the canonical answer for the PDF. The live
queries run in SQLite and differ only where the dialects do:
`DATE_SUB(d, INTERVAL n DAY)` → `DATE(d,'-n day')`,
`SUBSTRING_INDEX(name,' ',1)` → `SUBSTR(name,1,INSTR(name||' ',' ')-1)`,
`DATE_FORMAT(d,'%Y-%m')` → `strftime('%Y-%m', d)`. `MONTHNAME`/`DAYNAME` are
registered as SQLite functions so those queries read identically. "Today" is
fixed to **2025-04-16** per the assignment.
