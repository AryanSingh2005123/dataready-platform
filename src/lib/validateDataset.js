// Orchestrates validation of a whole transaction dataset, field by field, row by
// row. The platform is schema-flexible: it auto-detects which columns are id /
// name / phone / date / email, and the user can override the mapping.

import { validatePhone } from './countryRules.js'
import { validateDateTime } from './dateRules.js'

// Logical field roles the validator understands. Order is the display order.
export const ROLES = [
  { key: 'id', label: 'Order / ID', hint: 'unique identifier; duplicates are flagged' },
  { key: 'name', label: 'Name', hint: 'full name; must contain letters' },
  { key: 'phone', label: 'Phone', hint: 'validated against country rules' },
  { key: 'date', label: 'Date / time', hint: 'validated against accepted formats' },
  { key: 'email', label: 'Email', hint: 'basic RFC-ish format check' },
]

const HEADER_HINTS = {
  id: [/order.*id/i, /(?:^|[_\s])id\b/i, /_id\b/i, /txn/i, /transaction.*id/i, /invoice/i],
  name: [/name/i, /full.?name/i, /customer.?name/i, /\bfname\b/i],
  phone: [/phone/i, /mobile/i, /contact/i, /\bmsisdn\b/i, /\btel\b/i],
  date: [/date/i, /time/i, /\bts\b/i, /timestamp/i, /created/i],
  email: [/email/i, /e-mail/i, /\bmail\b/i],
}

// Columns that plausibly fit a role — by header name OR by sniffing a few sample
// values — so each mapping dropdown only offers sensible choices (e.g. the email
// role only lists email-like columns). The currently-selected column is always
// kept; if nothing matches we fall back to all columns so the user isn't stuck.
const EMAILish = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONEish = /^[+]?[\d\s()./-]{7,}$/
const DATEish = /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})|(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/

export function columnsForRole(role, headers, rows, current) {
  const sample = rows.slice(0, 8)
  const frac = (h, fn) => {
    const vals = sample.map((r) => String(r[h] ?? '').trim()).filter(Boolean)
    return vals.length ? vals.filter(fn).length / vals.length : 0
  }
  const matches = (h) => {
    if ((HEADER_HINTS[role] || []).some((re) => re.test(h))) return true
    if (role === 'email') return frac(h, (v) => EMAILish.test(v)) >= 0.5
    if (role === 'phone') return frac(h, (v) => PHONEish.test(v) && !DATEish.test(v) && v.replace(/\D/g, '').length <= 15) >= 0.5
    if (role === 'date') return frac(h, (v) => DATEish.test(v)) >= 0.5
    if (role === 'name') return frac(h, (v) => /^[A-Za-z][A-Za-z .'-]*$/.test(v)) >= 0.5
    return false // id: rely on header hints only (values are too ambiguous)
  }
  let cols = headers.filter(matches)
  if (current && !cols.includes(current)) cols = [current, ...cols]
  return cols.length ? cols : headers
}

// Best-effort guess of column->role from headers. Returns { role: columnName }.
export function autoDetectMapping(headers) {
  const mapping = {}
  const used = new Set()
  for (const role of Object.keys(HEADER_HINTS)) {
    for (const h of headers) {
      if (used.has(h)) continue
      if (HEADER_HINTS[role].some((re) => re.test(h))) {
        mapping[role] = h
        used.add(h)
        break
      }
    }
  }
  return mapping
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Validate one row against the mapping + config. Returns:
//   { valid, errors:[{field,message}], cleaned:{...}, raw }
function validateRow(row, cfg) {
  const { mapping, rules, defaultCountry, formats, requiredRoles } = cfg
  const errors = []
  const cleaned = { ...row }

  // Required (mapped) fields must be present.
  for (const role of requiredRoles) {
    const col = mapping[role]
    if (col && !String(row[col] ?? '').trim()) {
      errors.push({ field: col, message: `${role} is required but empty` })
    }
  }

  if (mapping.name) {
    const col = mapping.name
    const v = String(row[col] ?? '').trim()
    if (v) {
      if (!/[A-Za-z]/.test(v)) errors.push({ field: col, message: `name has no letters` })
      else cleaned[col] = v.replace(/\s+/g, ' ')
    }
  }

  if (mapping.phone) {
    const col = mapping.phone
    const v = String(row[col] ?? '').trim()
    if (v) {
      const r = validatePhone(v, rules, defaultCountry)
      if (!r.valid) errors.push({ field: col, message: `invalid phone — ${r.reason}` })
      else cleaned[col] = r.normalized
    }
  }

  if (mapping.date) {
    const col = mapping.date
    const v = String(row[col] ?? '').trim()
    if (v) {
      const r = validateDateTime(v, formats)
      if (!r.valid) errors.push({ field: col, message: `invalid date — ${r.reason}` })
      else cleaned[col] = r.iso
    }
  }

  if (mapping.email) {
    const col = mapping.email
    const v = String(row[col] ?? '').trim()
    if (v && !EMAIL_RE.test(v)) errors.push({ field: col, message: `invalid email format` })
    else if (v) cleaned[col] = v.toLowerCase()
  }

  return { valid: errors.length === 0, errors, cleaned, raw: row }
}

// Validate the full dataset. `rows` is an array of objects (PapaParse output).
export function validateDataset(rows, headers, cfg) {
  const results = rows.map((row) => validateRow(row, cfg))

  // Cross-row check: duplicate IDs.
  if (cfg.mapping.id) {
    const col = cfg.mapping.id
    const seen = new Map()
    rows.forEach((row, i) => {
      const key = String(row[col] ?? '').trim()
      if (!key) return
      if (seen.has(key)) {
        results[i].errors.push({ field: col, message: `duplicate ${col} "${key}" (first seen row ${seen.get(key) + 1})` })
        results[i].valid = false
      } else {
        seen.set(key, i)
      }
    })
  }

  const validRows = results.filter((r) => r.valid)
  const issueCounts = {}
  for (const r of results) {
    for (const e of r.errors) {
      const kind = e.message.split('—')[0].trim().replace(/"[^"]*"/g, '').replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim()
      issueCounts[kind] = (issueCounts[kind] || 0) + 1
    }
  }

  return {
    results,
    headers,
    total: rows.length,
    validCount: validRows.length,
    invalidCount: rows.length - validRows.length,
    issueCounts,
  }
}
