import { useMemo, useRef, useState } from 'react'
import {
  UploadCloud, FileSpreadsheet, Play, Download, Scissors, ShieldCheck,
  Phone, CalendarClock, X, Plus, RotateCcw, AlertTriangle, Sparkles, Loader2, Gauge,
} from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { defaultCountryRules } from '../lib/countryRules.js'
import { defaultDateFormats } from '../lib/dateRules.js'
import { ROLES, autoDetectMapping, validateDataset, defaultPaymentModes } from '../lib/validateDataset.js'
import { parseCsvFile, parseCsvText, downloadCsv, downloadErrorReport, downloadChunkedZip } from '../lib/csv.js'
import { parseXlsxFile, looksLikeExcel } from '../lib/excel.js'
import { buildStressTransactions, transactionColumns } from '../lib/sampleData.js'
import { summarizeReport, mapColumnsAi } from '../lib/ai.js'
import { addActivity } from '../lib/activity.js'

// How many validated rows to render at once. Large files stay responsive because
// we never put thousands of <tr> in the DOM; the user can opt into "show all".
const TABLE_CAP = 100

// Visual summary of a validation report: pass/fail donut + issue-type bar chart.
function ResultCharts({ report }) {
  const passRate = report.total ? Math.round((report.validCount / report.total) * 100) : 0
  const passData = [
    { name: 'Valid', value: report.validCount },
    { name: 'Issues', value: report.invalidCount },
  ]
  const issues = Object.entries(report.issueCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ name: k.length > 26 ? k.slice(0, 26) + '…' : k, value: v }))
  const centerColor = passRate >= 80 ? '#5cc79b' : passRate >= 50 ? '#d6a85b' : '#e08293'

  return (
    <div className="panel pad" style={{ marginBottom: 16 }}>
      <h3>Results at a glance</h3>
      <div className="row" style={{ alignItems: 'center' }}>
        <div style={{ width: 200, height: 200, position: 'relative', flex: 'none' }}>
          <ResponsiveContainer>
            <PieChart>
              <defs>
                <linearGradient id="gValid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#62c79c" /><stop offset="100%" stopColor="#3f9e78" />
                </linearGradient>
                <linearGradient id="gIssue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e493a1" /><stop offset="100%" stopColor="#bf6072" />
                </linearGradient>
              </defs>
              <Pie data={passData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                <Cell fill="url(#gValid)" /><Cell fill="url(#gIssue)" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', color: centerColor }}>{passRate}%</div>
              <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>pass</div>
            </div>
          </div>
        </div>
        <div className="grow" style={{ minWidth: 280, height: Math.max(170, issues.length * 34 + 24) }}>
          {issues.length ? (
            <ResponsiveContainer>
              <BarChart data={issues} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <defs>
                  <linearGradient id="gIssueBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#b65b6c" /><stop offset="100%" stopColor="#e08a9b" />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal={false} stroke="rgba(148,163,184,.1)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#8a97af' }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: '#8a97af' }} />
                <Tooltip cursor={{ fill: 'rgba(224,130,147,.1)' }} />
                <Bar dataKey="value" fill="url(#gIssueBar)" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
              <span className="pill good">No issues — every row passed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// AI: turn the validation report into a plain-English briefing + prioritized fixes.
function AiSummary({ report }) {
  const [summary, setSummary] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true); setError(null); setSummary('')
    const sample = report.results.filter((r) => !r.valid).slice(0, 10)
      .flatMap((r) => r.errors.map((e) => e.message)).slice(0, 12)
    try {
      const { summary: s } = await summarizeReport({
        total: report.total, valid: report.validCount, invalid: report.invalidCount,
        passRate: report.total ? Math.round((report.validCount / report.total) * 100) : 0,
        issueCounts: report.issueCounts, sampleIssues: sample,
      })
      setSummary(s)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel pad" style={{ marginBottom: 16, borderColor: 'var(--brand)' }}>
      <div className="row" style={{ alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}><Sparkles size={14} /> AI data-quality briefing</h3>
        <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={run} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Explain &amp; fix
        </button>
      </div>
      {!summary && !error && !busy && (
        <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>
          Get a plain-English summary of the issues and a prioritized fix list, written by Claude from this report.
        </p>
      )}
      {error && <pre className="code light" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</pre>}
      {summary && <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, margin: '12px 0 0' }}>{summary}</p>}
    </div>
  )
}

const REQUIRED_DEFAULT = ['id', 'phone', 'date']

// ---- small editable-list helpers ----
function ChipList({ items, onRemove, onAdd, placeholder }) {
  const [v, setV] = useState('')
  return (
    <div>
      <div className="chiprow" style={{ marginBottom: 8 }}>
        {items.map((it) => (
          <span className="chip" key={it}>{it}<button onClick={() => onRemove(it)}><X size={12} /></button></span>
        ))}
        {items.length === 0 && <span className="muted" style={{ fontSize: 12 }}>none</span>}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input type="text" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onAdd(v.trim()); setV('') } }} />
        <button className="btn" onClick={() => { if (v.trim()) { onAdd(v.trim()); setV('') } }}><Plus size={14} /></button>
      </div>
    </div>
  )
}

function CountryRuleEditor({ rules, setRules }) {
  function update(i, patch) {
    setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  return (
    <div className="tablewrap" style={{ maxHeight: 'none' }}>
      <table>
        <thead>
          <tr><th>Country</th><th>Code (+)</th><th>Digits</th><th>Starts with</th><th></th></tr>
        </thead>
        <tbody>
          {rules.map((r, i) => (
            <tr key={r.code + i}>
              <td><input type="text" value={r.name} onChange={(e) => update(i, { name: e.target.value })} style={{ minWidth: 120 }} /></td>
              <td><input type="text" value={r.dialCode} onChange={(e) => update(i, { dialCode: e.target.value.replace(/\D/g, '') })} style={{ width: 70 }} /></td>
              <td><input type="text" value={r.nationalDigits.join(',')} onChange={(e) => update(i, { nationalDigits: e.target.value.split(',').map((x) => parseInt(x, 10)).filter(Boolean) })} style={{ width: 80 }} /></td>
              <td><input type="text" value={r.startsWith.join('')} onChange={(e) => update(i, { startsWith: e.target.value.split('').filter((c) => /\d/.test(c)) })} style={{ width: 90 }} placeholder="any" /></td>
              <td><button className="btn ghost" onClick={() => setRules(rules.filter((_, j) => j !== i))}><X size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Validator() {
  const fileRef = useRef(null)
  const [over, setOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [defaultCountry, setDefaultCountry] = useState('IN')
  const [rules, setRules] = useState(defaultCountryRules)
  const [formats, setFormats] = useState(defaultDateFormats)
  const [paymentModes, setPaymentModes] = useState(defaultPaymentModes)
  const [required, setRequired] = useState(REQUIRED_DEFAULT)
  const [chunkSize, setChunkSize] = useState(5)
  const [report, setReport] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [mapBusy, setMapBusy] = useState(false)
  const [mapMsg, setMapMsg] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [loadError, setLoadError] = useState(null)

  function loadData(parsedRows, parsedHeaders, name) {
    setRows(parsedRows)
    setHeaders(parsedHeaders)
    setMapping(autoDetectMapping(parsedHeaders))
    setReport(null)
    setFileName(name)
  }

  async function onFile(file) {
    if (!file) return
    setLoadError(null)
    try {
      const excel = await looksLikeExcel(file)
      const { rows: r, headers: h } = excel ? await parseXlsxFile(file) : await parseCsvFile(file)
      if (!h.length || !r.length) {
        setLoadError('No rows found in that file. Make sure the first row contains column headers.')
        return
      }
      loadData(r, h, file.name)
    } catch (e) {
      setLoadError(`Could not read "${file.name}": ${e.message || e}. Supported: CSV and Excel (.xlsx/.xls).`)
    }
  }

  // Load the real CSV artifact shipped in /public.
  async function loadSample() {
    const text = await fetch('/sample-transactions.csv').then((r) => r.text())
    const { rows: r, headers: h } = parseCsvText(text)
    loadData(r, h, 'sample-transactions.csv')
  }

  // Large synthetic dataset to demonstrate that validation + rendering stay fast.
  function loadStress() {
    loadData(buildStressTransactions(5000), transactionColumns, 'stress-5000-rows.csv')
  }

  function runValidation() {
    const cfg = { mapping, rules, defaultCountry, formats, paymentModes, requiredRoles: required }
    const t0 = performance.now()
    const result = validateDataset(rows, headers, cfg)
    result.ms = Math.round(performance.now() - t0)
    setShowAll(false)
    setReport(result)
    addActivity({ file: fileName, total: result.total, valid: result.validCount, invalid: result.invalidCount, ms: result.ms })
  }

  // AI column mapping — useful for messy / non-English / unconventional headers.
  async function aiMap() {
    setMapBusy(true); setMapMsg(null)
    try {
      const { mapping: m } = await mapColumnsAi(headers, rows.slice(0, 5))
      setMapping(m)
      const hits = Object.keys(m).length
      setMapMsg({ ok: true, text: `AI mapped ${hits} of ${ROLES.length} role${hits === 1 ? '' : 's'}.` })
    } catch (e) {
      setMapMsg({ ok: false, text: String(e.message || e) })
    } finally {
      setMapBusy(false)
    }
  }

  const cleanedRows = useMemo(() => (report ? report.results.filter((r) => r.valid).map((r) => r.cleaned) : []), [report])

  const errorFieldsByRow = useMemo(() => {
    if (!report) return []
    return report.results.map((r) => {
      const m = {}
      for (const e of r.errors) m[e.field] = (m[e.field] ? m[e.field] + '; ' : '') + e.message
      return m
    })
  }, [report])

  return (
    <>
      <div className="panel pad hero" style={{ marginBottom: 18 }}>
        <span className="eyebrow">Part 4 · AI Empowerment</span>
        <h1 style={{ marginTop: 8 }}>Transaction Validator</h1>
        <p className="lead" style={{ maxWidth: 760 }}>
          Upload a transaction dataset (order, product and payment fields). The platform validates phone numbers
          against configurable country rules, checks dates against accepted formats, runs integrity checks, then
          lets you download a cleaned file and split large files into chunks.
        </p>
      </div>

      {/* ---- input ---- */}
      {rows.length === 0 ? (
        <>
        <div
          className={`drop ${over ? 'over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]) }}
        >
          <UploadCloud size={34} className="muted" />
          <h3 style={{ margin: '10px 0 4px' }}>Drop a CSV or Excel file here, or click to browse</h3>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            .csv, .xlsx or .xls · first row = headers · or <button className="btn ghost" style={{ padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); loadSample() }}><FileSpreadsheet size={14} /> load the sample</button>
          </p>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" hidden onChange={(e) => onFile(e.target.files[0])} />
        </div>
        {loadError && (
          <div className="panel pad" style={{ marginTop: 14, borderColor: 'var(--bad)' }}>
            <span className="pill bad"><AlertTriangle size={13} /> {loadError}</span>
          </div>
        )}
        </>
      ) : (
        <div className="panel pad" style={{ marginBottom: 18 }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="pill brand"><FileSpreadsheet size={14} /> {fileName}</span>
            <span className="muted" style={{ fontSize: 13 }}>{rows.length} rows · {headers.length} columns</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn ghost" onClick={loadSample}><FileSpreadsheet size={14} /> Sample</button>
              <button className="btn ghost" onClick={loadStress} title="Load 5,000 synthetic rows"><Gauge size={14} /> 5k stress</button>
              <button className="btn ghost" onClick={() => { setRows([]); setHeaders([]); setReport(null); setFileName('') }}><RotateCcw size={14} /> Reset</button>
            </div>
          </div>

          {/* ---- column mapping ---- */}
          <hr className="divider" />
          <div className="row" style={{ alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Column mapping <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· auto-detected, editable</span></h3>
            <button className="btn" style={{ marginLeft: 'auto', borderColor: 'var(--brand)', color: 'var(--brand-ink)' }} onClick={aiMap} disabled={mapBusy}>
              {mapBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Auto-map with AI
            </button>
          </div>
          {mapMsg && (
            <p className={mapMsg.ok ? 'muted' : ''} style={{ fontSize: 13, margin: '0 0 10px', color: mapMsg.ok ? undefined : 'var(--bad)' }}>
              {mapMsg.text}
            </p>
          )}
          <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
            {ROLES.map((role) => (
              <div key={role.key}>
                <label className="field" title={role.hint}>{role.label}</label>
                <select value={mapping[role.key] || ''} onChange={(e) => setMapping({ ...mapping, [role.key]: e.target.value || undefined })}>
                  <option value="">— none —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 200 }}>
              <label className="field"><Phone size={12} /> Default country (local-format numbers)</label>
              <select value={defaultCountry} onChange={(e) => setDefaultCountry(e.target.value)}>
                {rules.map((r) => <option key={r.code} value={r.code}>{r.name} (+{r.dialCode})</option>)}
              </select>
            </div>
            <button className="btn" onClick={() => setShowConfig((s) => !s)}>{showConfig ? 'Hide' : 'Show'} validation rules</button>
            <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={runValidation}><Play size={16} /> Validate {rows.length} rows</button>
          </div>

          {/* ---- rule config ---- */}
          {showConfig && (
            <div style={{ marginTop: 16 }}>
              <hr className="divider" />
              <div className="row">
                <div className="grow" style={{ flexBasis: 460 }}>
                  <h3><Phone size={14} /> Country phone rules</h3>
                  <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Digits = allowed national-number lengths. Editable & extensible.</p>
                  <CountryRuleEditor rules={rules} setRules={setRules} />
                  <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setRules([...rules, { code: 'XX' + rules.length, name: 'New country', dialCode: '', nationalDigits: [10], startsWith: [], example: '' }])}><Plus size={14} /> Add country</button>
                </div>
                <div className="grow" style={{ flexBasis: 300 }}>
                  <h3><CalendarClock size={14} /> Accepted date formats</h3>
                  <ChipList items={formats} placeholder="e.g. YYYY/MM/DD"
                    onRemove={(x) => setFormats(formats.filter((f) => f !== x))}
                    onAdd={(x) => setFormats([...new Set([...formats, x])])} />
                  <h3 style={{ marginTop: 18 }}><ShieldCheck size={14} /> Allowed payment modes</h3>
                  <ChipList items={paymentModes} placeholder="e.g. ApplePay"
                    onRemove={(x) => setPaymentModes(paymentModes.filter((m) => m !== x))}
                    onAdd={(x) => setPaymentModes([...new Set([...paymentModes, x])])} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- results ---- */}
      {report && (
        <>
          <div className="stats" style={{ marginBottom: 16 }}>
            <div className="stat"><div className="n">{report.total.toLocaleString()}</div><div className="k">Total rows</div></div>
            <div className="stat good"><div className="n">{report.validCount.toLocaleString()}</div><div className="k">Valid</div></div>
            <div className="stat bad"><div className="n">{report.invalidCount.toLocaleString()}</div><div className="k">With issues</div></div>
            <div className="stat"><div className="n">{report.total ? Math.round((report.validCount / report.total) * 100) : 0}%</div><div className="k">Pass rate</div></div>
            <div className="stat"><div className="n">{report.ms}<span style={{ fontSize: 14 }}>ms</span></div><div className="k">Validated in</div></div>
          </div>

          <ResultCharts report={report} />

          <AiSummary report={report} />

          <div className="panel pad" style={{ marginBottom: 16 }}>
            <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Validated rows <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· invalid cells highlighted</span></h3>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={() => downloadCsv(cleanedRows, headers, 'cleaned_transactions.csv')} disabled={!cleanedRows.length}>
                  <Download size={15} /> Cleaned CSV ({cleanedRows.length})
                </button>
                <button className="btn" onClick={() => downloadErrorReport(report.results, headers, 'validation_errors.csv')} disabled={!report.invalidCount}>
                  <Download size={15} /> Errors report
                </button>
              </div>
            </div>

            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>#</th>{headers.map((h) => <th key={h}>{h}</th>)}<th>Status</th></tr>
                </thead>
                <tbody>
                  {(showAll ? report.results : report.results.slice(0, TABLE_CAP)).map((r, i) => (
                    <tr key={i} className={r.valid ? '' : 'row-bad'}>
                      <td className="muted">{i + 1}</td>
                      {headers.map((h) => {
                        const bad = errorFieldsByRow[i][h]
                        return <td key={h} className={`cellmono ${bad ? 'cell-bad' : ''}`} title={bad || ''}>{String(r.raw[h] ?? '')}</td>
                      })}
                      <td>{r.valid ? <span className="pill good">ok</span> : <span className="pill bad">{r.errors.length}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.total > TABLE_CAP && (
              <div className="row" style={{ alignItems: 'center', marginTop: 10 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  Showing {showAll ? report.total.toLocaleString() : TABLE_CAP} of {report.total.toLocaleString()} rows
                  {!showAll && ' (capped for performance)'}.
                </span>
                <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => setShowAll((s) => !s)}>
                  {showAll ? `Show first ${TABLE_CAP}` : `Show all ${report.total.toLocaleString()} rows`}
                </button>
              </div>
            )}
          </div>

          {/* ---- chunking ---- */}
          <div className="panel pad">
            <h3><Scissors size={14} /> Split into chunks</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Break the cleaned output into evenly sized CSV parts, bundled as one <code>.zip</code> with a manifest —
              for efficient handling of large files.
            </p>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div style={{ width: 160 }}>
                <label className="field">Rows per chunk</label>
                <input type="number" min={1} value={chunkSize} onChange={(e) => setChunkSize(Math.max(1, parseInt(e.target.value, 10) || 1))} />
              </div>
              <span className="muted" style={{ fontSize: 13, paddingBottom: 10 }}>
                → {Math.max(1, Math.ceil(cleanedRows.length / chunkSize))} part(s) from {cleanedRows.length} cleaned rows
              </span>
              <button className="btn primary" style={{ marginLeft: 'auto' }} disabled={!cleanedRows.length}
                onClick={() => downloadChunkedZip(cleanedRows, headers, chunkSize, 'cleaned_transactions')}>
                <Scissors size={15} /> Download chunks (.zip)
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
