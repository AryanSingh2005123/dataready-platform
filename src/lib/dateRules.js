// Date & time validation against a configurable list of predefined formats.
//
// Rather than pull in a date library, we compile each format string into a regex
// plus an extractor. A value is valid if it matches at least one accepted format
// AND represents a real calendar date/time. Valid values are normalized to ISO
// (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss) so the cleaned output is consistent.

export const defaultDateFormats = [
  'YYYY-MM-DD',
  'YYYY-MM-DD HH:mm:ss',
  'DD/MM/YYYY',
  'DD/MM/YYYY HH:mm',
  'MM/DD/YYYY',
  'DD-MM-YYYY',
]

// Order matters: longer tokens first so MM isn't eaten before MMM, etc.
const TOKENS = [
  ['YYYY', '(?<YYYY>\\d{4})'],
  ['MM', '(?<MM>\\d{2})'],
  ['DD', '(?<DD>\\d{2})'],
  ['HH', '(?<HH>\\d{2})'],
  ['mm', '(?<mm>\\d{2})'],
  ['ss', '(?<ss>\\d{2})'],
]

function compile(format) {
  let pattern = ''
  let i = 0
  while (i < format.length) {
    const token = TOKENS.find(([t]) => format.startsWith(t, i))
    if (token) {
      pattern += token[1]
      i += token[0].length
    } else {
      // Escape literal separators (spaces, / - : etc.)
      pattern += format[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      i += 1
    }
  }
  return new RegExp(`^${pattern}$`)
}

const compiledCache = new Map()
function regexFor(format) {
  if (!compiledCache.has(format)) compiledCache.set(format, compile(format))
  return compiledCache.get(format)
}

function isRealDate(y, mo, d, h, mi, s) {
  if (mo < 1 || mo > 12) return false
  const dim = new Date(y, mo, 0).getDate() // last day of month mo
  if (d < 1 || d > dim) return false
  if (h > 23 || mi > 59 || s > 59) return false
  return true
}

const p2 = (n) => String(n).padStart(2, '0')

// Returns { valid, iso, matchedFormat, reason }
export function validateDateTime(raw, formats) {
  const value = String(raw ?? '').trim()
  if (!value) return { valid: false, iso: '', matchedFormat: null, reason: 'empty' }

  for (const fmt of formats) {
    const m = regexFor(fmt).exec(value)
    if (!m) continue
    const g = m.groups
    const y = +g.YYYY
    const mo = +g.MM
    const d = +g.DD
    const h = g.HH ? +g.HH : 0
    const mi = g.mm ? +g.mm : 0
    const s = g.ss ? +g.ss : 0
    if (!isRealDate(y, mo, d, h, mi, s)) {
      return { valid: false, iso: '', matchedFormat: fmt, reason: `matches ${fmt} but is not a real date/time` }
    }
    const hasTime = fmt.includes('HH')
    const iso = hasTime
      ? `${y}-${p2(mo)}-${p2(d)}T${p2(h)}:${p2(mi)}:${p2(s)}`
      : `${y}-${p2(mo)}-${p2(d)}`
    return { valid: true, iso, matchedFormat: fmt, reason: '' }
  }

  return { valid: false, iso: '', matchedFormat: null, reason: `doesn't match any accepted format` }
}
