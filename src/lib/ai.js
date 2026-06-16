// Thin client for the /api/ai endpoint. Returns parsed JSON or throws with the
// server's error message (e.g. the 503 "AI not configured" notice).
async function callAi(body) {
  let res
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the AI endpoint.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `AI request failed (${res.status}).`)
  return data
}

// Natural language → { sql, explanation }.
export function askSql(question) {
  return callAi({ action: 'text_to_sql', question })
}

// Validation report summary → { summary }.
export function summarizeReport(report) {
  return callAi({ action: 'summarize', report })
}

// Headers + sample rows → { mapping: { role: columnName } }.
export function mapColumnsAi(headers, sample) {
  return callAi({ action: 'map_columns', headers, sample })
}

// Guard: only allow a single read-only SELECT/WITH to run against the in-browser DB.
export function isSafeSelect(sql) {
  const s = String(sql || '').trim().replace(/;+\s*$/, '')
  if (/;/.test(s)) return false // single statement only
  if (!/^(select|with)\b/i.test(s)) return false
  if (/\b(insert|update|delete|drop|alter|create|attach|pragma|replace|vacuum)\b/i.test(s)) return false
  return true
}
