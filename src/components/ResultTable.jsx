// Renders a { columns, rows } result set (rows = array of arrays). Used by the
// SQL workbench. Caps displayed rows for sanity but reports the true total.
export default function ResultTable({ columns, rows, cap = 200 }) {
  if (!columns?.length) {
    return <p className="muted" style={{ margin: 0 }}>No rows.</p>
  }
  const shown = rows.slice(0, cap)
  return (
    <>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              {columns.map((c) => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                <td className="muted">{i + 1}</td>
                {r.map((v, j) => <td key={j} className="cellmono">{v === null ? '∅' : String(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '8px 2px 0' }}>
        {rows.length} row{rows.length === 1 ? '' : 's'}{rows.length > cap ? ` (showing first ${cap})` : ''}.
      </p>
    </>
  )
}
