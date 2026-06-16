// Excel (.xlsx/.xls) parsing. SheetJS is heavy, so it's loaded on demand only
// when an Excel file is actually opened — keeping the initial bundle small.
// Output matches the CSV parser: { rows: object[], headers: string[] } with all
// values normalised to strings (Excel date serials → ISO YYYY-MM-DD).

const p2 = (n) => String(n).padStart(2, '0')

function cellToString(v) {
  if (v == null) return ''
  if (v instanceof Date) return `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}`
  return String(v)
}

export async function parseXlsxFile(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { rows: [], headers: [] }
  const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })
  const headers = json.length ? Object.keys(json[0]) : []
  const rows = json.map((r) => {
    const o = {}
    for (const h of headers) o[h] = cellToString(r[h])
    return o
  })
  return { rows, headers }
}

// Sniff whether a file is really a spreadsheet, regardless of its name — .xlsx is
// a ZIP (magic "PK\x03\x04"), legacy .xls is an OLE compound file ("D0 CF 11 E0").
export async function looksLikeExcel(file) {
  if (/\.(xlsx|xlsm|xlsb|xls)$/i.test(file.name)) return true
  if (/sheet|excel|ms-excel/i.test(file.type || '')) return true
  try {
    const sig = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    return (sig[0] === 0x50 && sig[1] === 0x4b) || (sig[0] === 0xd0 && sig[1] === 0xcf)
  } catch {
    return false
  }
}
