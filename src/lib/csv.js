// CSV I/O: parsing (PapaParse), building output files, and splitting large files
// into manageable chunks bundled as a single .zip download.
import Papa from 'papaparse'
import JSZip from 'jszip'

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = res.meta.fields || []
        resolve({ rows: res.data, headers })
      },
      error: reject,
    })
  })
}

export function parseCsvText(text) {
  const res = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() })
  return { rows: res.data, headers: res.meta.fields || [] }
}

export function toCsv(rows, headers) {
  return Papa.unparse({ fields: headers, data: rows.map((r) => headers.map((h) => r[h] ?? '')) })
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(rows, headers, filename) {
  triggerDownload(new Blob([toCsv(rows, headers)], { type: 'text/csv;charset=utf-8' }), filename)
}

// Build an errors report: original row data + a joined reason column.
export function downloadErrorReport(results, headers, filename) {
  const failed = results.filter((r) => !r.valid)
  const cols = [...headers, '__issues']
  const rows = failed.map((r) => ({ ...r.raw, __issues: r.errors.map((e) => `${e.field}: ${e.message}`).join(' | ') }))
  downloadCsv(rows, cols, filename)
}

// Split rows into chunks of `chunkSize` and download them as one zip.
export async function downloadChunkedZip(rows, headers, chunkSize, baseName) {
  const zip = new JSZip()
  const total = Math.max(1, Math.ceil(rows.length / chunkSize))
  for (let i = 0; i < total; i++) {
    const slice = rows.slice(i * chunkSize, (i + 1) * chunkSize)
    const part = String(i + 1).padStart(String(total).length, '0')
    zip.file(`${baseName}_part_${part}_of_${total}.csv`, toCsv(slice, headers))
  }
  const manifest = [
    `source rows: ${rows.length}`,
    `chunk size:  ${chunkSize}`,
    `parts:       ${total}`,
    `generated:   ${new Date().toISOString()}`,
  ].join('\n')
  zip.file('MANIFEST.txt', manifest)
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${baseName}_chunks.zip`)
  return total
}
