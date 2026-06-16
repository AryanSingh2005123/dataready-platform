import { useMemo, useRef, useState } from 'react'
import {
  UploadCloud, FileSpreadsheet, Play, Download, Scissors, ShieldCheck,
  Phone, CalendarClock, X, Plus, RotateCcw, AlertTriangle, Sparkles, Loader2,
} from 'lucide-react'
import { defaultCountryRules } from '../lib/countryRules.js'
import { defaultDateFormats } from '../lib/dateRules.js'
import { ROLES, autoDetectMapping, validateDataset, defaultPaymentModes } from '../lib/validateDataset.js'
import { parseCsvFile, downloadCsv, downloadErrorReport, downloadChunkedZip } from '../lib/csv.js'
import { buildTransactions, transactionColumns } from '../lib/sampleData.js'
import { summarizeReport, mapColumnsAi } from '../lib/ai.js'

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

  function loadData(parsedRows, parsedHeaders, name) {
    setRows(parsedRows)
    setHeaders(parsedHeaders)
    setMapping(autoDetectMapping(parsedHeaders))
    setReport(null)
    setFileName(name)
  }

  async function onFile(file) {
    if (!file) return
    const { rows: r, headers: h } = await parseCsvFile(file)
    loadData(r, h, file.name)
  }

  function loadSample() {
    loadData(buildTransactions(), transactionColumns, 'sample_transactions.csv')
  }

  function runValidation() {
    const cfg = { mapping, rules, defaultCountry, formats, paymentModes, requiredRoles: required }
    setReport(validateDataset(rows, headers, cfg))
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
      <div className="panel pad" style={{ marginBottom: 18 }}>
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
        <div
          className={`drop ${over ? 'over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]) }}
        >
          <UploadCloud size={34} className="muted" />
          <h3 style={{ margin: '10px 0 4px' }}>Drop a CSV here, or click to browse</h3>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Headers expected · or <button className="btn ghost" style={{ padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); loadSample() }}><FileSpreadsheet size={14} /> load the sample</button>
          </p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="panel pad" style={{ marginBottom: 18 }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="pill brand"><FileSpreadsheet size={14} /> {fileName}</span>
            <span className="muted" style={{ fontSize: 13 }}>{rows.length} rows · {headers.length} columns</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn ghost" onClick={loadSample}><FileSpreadsheet size={14} /> Sample</button>
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
            <div className="stat"><div className="n">{report.total}</div><div className="k">Total rows</div></div>
            <div className="stat good"><div className="n">{report.validCount}</div><div className="k">Valid</div></div>
            <div className="stat bad"><div className="n">{report.invalidCount}</div><div className="k">With issues</div></div>
            <div className="stat"><div className="n">{report.total ? Math.round((report.validCount / report.total) * 100) : 0}%</div><div className="k">Pass rate</div></div>
          </div>

          {Object.keys(report.issueCounts).length > 0 && (
            <div className="panel pad" style={{ marginBottom: 16 }}>
              <h3><AlertTriangle size={14} /> Issue breakdown</h3>
              <div className="chiprow">
                {Object.entries(report.issueCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <span className="pill bad" key={k}>{k} · {n}</span>
                ))}
              </div>
            </div>
          )}

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
                  {report.results.map((r, i) => (
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
