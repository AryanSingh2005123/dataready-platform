import { useEffect, useState } from 'react'
import { Play, ChevronDown, ChevronRight, Loader2, Database, Download, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { sections, dataReviewAnswer, TODAY } from '../lib/queries.js'
import { run } from '../lib/db.js'
import { buildCustomers, customerColumns } from '../lib/sampleData.js'
import { downloadCsv } from '../lib/csv.js'
import ResultTable from '../components/ResultTable.jsx'

function Chart({ result, cfg }) {
  const xi = result.columns.indexOf(cfg.x)
  const yi = result.columns.indexOf(cfg.y)
  if (xi < 0 || yi < 0) return null
  const data = result.rows.map((r) => ({ name: String(r[xi]), value: Number(r[yi]) }))
  return (
    <div style={{ height: 240, marginTop: 14 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 50 : 24} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
          <Tooltip cursor={{ fill: '#eff6ff' }} />
          <Bar dataKey="value" fill="#2563eb" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function QueryCard({ q, idx }) {
  const [open, setOpen] = useState(false)
  const [dialect, setDialect] = useState('mysql')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function execute() {
    setBusy(true)
    setError(null)
    try {
      setResult(await run(q.sql))
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !result && !busy) execute()
  }

  return (
    <div className="qcard">
      <div className="qhead" onClick={toggle}>
        <span className="idx">{idx}</span>
        <strong className="grow">{q.title}</strong>
        {result && !error && <span className="pill good">{result.rows.length} rows</span>}
        {error && <span className="pill bad"><AlertTriangle size={13} /> error</span>}
        {open ? <ChevronDown size={18} className="muted" /> : <ChevronRight size={18} className="muted" />}
      </div>

      {open && (
        <div className="qbody">
          {q.note && <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{q.note}</p>}

          <div className="tabset">
            <button className={`minitab ${dialect === 'mysql' ? 'active' : ''}`} onClick={() => setDialect('mysql')}>MySQL (answer)</button>
            <button className={`minitab ${dialect === 'sql' ? 'active' : ''}`} onClick={() => setDialect('sql')}>SQLite (run live)</button>
          </div>
          <pre className="code">{dialect === 'mysql' ? q.mysql : q.sql}</pre>

          <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
            <button className="btn primary" onClick={execute} disabled={busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Run live
            </button>
            <span className="muted" style={{ fontSize: 12 }}>Executes the SQLite query against the in-browser dataset.</span>
          </div>

          {error && <pre className="code light" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</pre>}
          {result && !error && (
            <div style={{ marginTop: 12 }}>
              <ResultTable columns={result.columns} rows={result.rows} />
              {q.chart && result.rows.length > 0 && <Chart result={result} cfg={q.chart} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SqlWorkbench() {
  const [ready, setReady] = useState(false)

  // Warm the DB up front so the first "Run" is instant.
  useEffect(() => { run('SELECT 1;').then(() => setReady(true)).catch(() => setReady(true)) }, [])

  return (
    <>
      <div className="panel pad" style={{ marginBottom: 18 }}>
        <span className="eyebrow">Parts 1–3 · SQL & Data Familiarity, Transformation, Analytics</span>
        <h1 style={{ marginTop: 8 }}>SQL Workbench</h1>
        <p className="lead" style={{ maxWidth: 760 }}>
          A sample <code>customers</code> table (160 rows) and an <code>orders</code> table are loaded into an
          in-browser SQLite engine. Every assignment query is shown in its canonical <strong>MySQL</strong> form
          and can be <strong>run live</strong> to produce a real result table. <span className="muted">"Today" is fixed to {TODAY}.</span>
        </p>
        <div className="row" style={{ marginTop: 14, alignItems: 'center' }}>
          <span className={`pill ${ready ? 'good' : 'warn'}`}>
            {ready ? <><Database size={13} /> engine ready</> : <><Loader2 size={13} className="spin" /> loading SQLite…</>}
          </span>
          <button className="btn" onClick={() => downloadCsv(buildCustomers(), customerColumns, 'customers_sample.csv')}>
            <Download size={15} /> Download customers.csv
          </button>
        </div>
      </div>

      <div className="panel pad" style={{ marginBottom: 18 }}>
        <h3>Q1 — Steps to review the data before importing</h3>
        <ol className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: '4px 0 0', paddingLeft: 18 }}>
          {dataReviewAnswer.map((l, i) => <li key={i} style={{ marginBottom: 5 }}>{l}</li>)}
        </ol>
      </div>

      {sections.map((s) => (
        <section key={s.id} style={{ marginBottom: 26 }}>
          <h2 style={{ margin: '0 4px 2px' }}>{s.title}</h2>
          <p className="muted" style={{ margin: '0 4px 12px', fontSize: 14 }}>{s.blurb}</p>
          {s.queries.map((q, i) => <QueryCard key={q.id} q={q} idx={i + 1} />)}
        </section>
      ))}
    </>
  )
}
