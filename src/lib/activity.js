// A real, session-persistent activity log of files the user has validated.
// Backed by localStorage so it survives navigation and reloads. This is the
// data behind the Overview "Validation activity" widget — no mock data.

const KEY = 'dataready.activity.v1'
const MAX = 25

export function getActivity() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function addActivity(entry) {
  const list = [{ ...entry, ts: Date.now() }, ...getActivity()].slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
  return list
}

export function clearActivity() {
  try { localStorage.removeItem(KEY) } catch {}
}

// Aggregate totals across the log.
export function activityTotals(list) {
  const rows = list.reduce((s, e) => s + (e.total || 0), 0)
  const valid = list.reduce((s, e) => s + (e.valid || 0), 0)
  return {
    datasets: list.length,
    rows,
    cleaned: valid,
    avgPass: rows ? Math.round((valid / rows) * 100) : 0,
  }
}

export function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
