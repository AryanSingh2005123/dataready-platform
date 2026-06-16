import { useState, useEffect } from 'react'
import { ShieldCheck, Database, Phone, CalendarClock, Scissors, ArrowRight, Activity, FileSpreadsheet, Trash2 } from 'lucide-react'
import { dataReviewAnswer } from '../lib/queries.js'
import { getActivity, activityTotals, timeAgo, clearActivity } from '../lib/activity.js'

const pct = (e) => (e.total ? Math.round((e.valid / e.total) * 100) : 0)

// Genuine session dashboard: the files the user has actually validated.
function ActivityWidget({ goTo }) {
  const [log, setLog] = useState([])
  useEffect(() => { setLog(getActivity()) }, [])
  const totals = activityTotals(log)

  return (
    <div className="panel pad" style={{ marginBottom: 22 }}>
      <span className="eyebrow"><Activity size={12} /> Session dashboard</span>
      <div className="row" style={{ alignItems: 'center', margin: '6px 0 14px' }}>
        <h2 style={{ margin: 0 }}>Validation activity</h2>
        {log.length > 0 && (
          <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => { clearActivity(); setLog([]) }}>
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      <div className="stats" style={{ marginBottom: log.length ? 16 : 0 }}>
        <div className="stat"><div className="n">{totals.datasets}</div><div className="k">Datasets validated</div></div>
        <div className="stat"><div className="n">{totals.rows.toLocaleString()}</div><div className="k">Rows processed</div></div>
        <div className="stat good"><div className="n">{totals.cleaned.toLocaleString()}</div><div className="k">Clean rows</div></div>
        <div className="stat"><div className="n">{totals.avgPass}%</div><div className="k">Avg pass rate</div></div>
      </div>

      {log.length ? (
        <div className="tablewrap" style={{ maxHeight: 260 }}>
          <table>
            <thead><tr><th>File</th><th>Rows</th><th>Valid</th><th>Pass</th><th>Time</th><th>When</th></tr></thead>
            <tbody>
              {log.map((e, i) => (
                <tr key={i}>
                  <td><FileSpreadsheet size={13} style={{ verticalAlign: '-2px', marginRight: 6, opacity: .55 }} />{e.file || 'dataset'}</td>
                  <td className="cellmono">{(e.total || 0).toLocaleString()}</td>
                  <td className="cellmono">{(e.valid || 0).toLocaleString()}</td>
                  <td><span className={`pill ${pct(e) >= 80 ? 'good' : pct(e) >= 50 ? 'warn' : 'bad'}`}>{pct(e)}%</span></td>
                  <td className="cellmono muted">{e.ms}ms</td>
                  <td className="muted">{timeAgo(e.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          No validations yet — open the{' '}
          <button className="btn ghost" style={{ padding: '2px 8px' }} onClick={() => goTo('validator')}>Validator</button>{' '}
          and run a file. Each run is recorded here (stored locally in your browser).
        </p>
      )}
    </div>
  )
}

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
      <div className="panel pad hero" style={{ marginBottom: 22 }}>
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

      <ActivityWidget goTo={goTo} />

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
