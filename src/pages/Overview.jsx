import { ShieldCheck, Database, Phone, CalendarClock, Scissors, Download, ArrowRight } from 'lucide-react'
import { dataReviewAnswer } from '../lib/queries.js'

function Capability({ icon: Icon, title, children }) {
  return (
    <div className="panel pad" style={{ flex: '1 1 240px' }}>
      <span className="pill brand"><Icon size={14} /> </span>
      <h3 style={{ marginTop: 10 }}>{title}</h3>
      <p className="muted" style={{ fontSize: 14, margin: 0, lineHeight: 1.5 }}>{children}</p>
    </div>
  )
}

export default function Overview({ goTo }) {
  return (
    <>
      <div className="panel pad" style={{ marginBottom: 22 }}>
        <span className="eyebrow">Xeno · Implementation Internship</span>
        <h1 style={{ marginTop: 8 }}>A data-readiness workbench for transaction data</h1>
        <p className="lead" style={{ maxWidth: 720 }}>
          One place that covers the whole brief: a <strong>transaction validation engine</strong> (Part 4)
          that checks phone numbers against configurable country rules, validates dates and formats, runs
          integrity checks, and exports a cleaned, chunked output — plus a <strong>live SQL workbench</strong> that
          executes every Part 1–3 query against a real sample <code>customers</code> table. Everything runs
          client-side; no transaction data ever leaves the browser.
        </p>
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={() => goTo('validator')}>
            <ShieldCheck size={16} /> Open the validator <ArrowRight size={15} />
          </button>
          <button className="btn" onClick={() => goTo('sql')}>
            <Database size={16} /> Open the SQL workbench
          </button>
        </div>
      </div>

      <h2 style={{ margin: '8px 4px 12px' }}>Part 4 — what the platform does</h2>
      <div className="row" style={{ marginBottom: 26 }}>
        <Capability icon={Phone} title="Country-driven phone validation">
          Configurable rules per country code — Singapore 8 digits, India 10 digits, and more. Auto-detects
          country from <code>+NN</code> prefixes and normalises each number.
        </Capability>
        <Capability icon={CalendarClock} title="Date & format checks">
          Validates dates against a configurable set of accepted formats, rejects impossible dates, and
          normalises everything to ISO.
        </Capability>
        <Capability icon={ShieldCheck} title="Integrity checks">
          Required fields, numeric amounts, email format, allowed payment modes, and duplicate order IDs —
          across every row.
        </Capability>
        <Capability icon={Scissors} title="Clean output + chunking">
          Download a validated CSV and an errors report, and auto-split large files into evenly sized chunks
          bundled as a single <code>.zip</code>.
        </Capability>
      </div>

      <div className="row">
        <div className="panel pad grow" style={{ flexBasis: 420 }}>
          <span className="eyebrow">Parts 1–3</span>
          <h2 style={{ marginTop: 6 }}>Live SQL, not screenshots</h2>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
            The SQL Workbench ships a sample <code>customers</code> table (and an <code>orders</code> table) and
            runs every required query in-browser via SQLite (WASM). Each task shows the canonical
            <strong> MySQL</strong> answer for the PDF alongside the <strong>live result</strong> it produces —
            with charts for the aggregate questions.
          </p>
          <button className="btn" onClick={() => goTo('sql')} style={{ marginTop: 6 }}>
            <Database size={16} /> Run the queries <ArrowRight size={15} />
          </button>
        </div>

        <div className="panel pad grow" style={{ flexBasis: 420 }}>
          <span className="eyebrow">Part 1 · Q1</span>
          <h2 style={{ marginTop: 6 }}>How I'd review the data before import</h2>
          <ol className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: '6px 0 0', paddingLeft: 18 }}>
            {dataReviewAnswer.map((line, i) => <li key={i} style={{ marginBottom: 6 }}>{line}</li>)}
          </ol>
        </div>
      </div>
    </>
  )
}
