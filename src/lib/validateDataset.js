// Orchestrates validation of a whole transaction dataset, field by field, row by
// row. The platform is schema-flexible: it auto-detects which columns are phone /
// date / amount / email / payment mode / id, and the user can override the mapping.

import { validatePhone } from './countryRules.js'
import { validateDateTime } from './dateRules.js'

// Logical field roles the validator understands. Order is the display order.
export const ROLES = [
  { key: 'id', label: 'Order / ID', hint: 'unique identifier; duplicates are flagged' },
  { key: 'phone', label: 'Phone', hint: 'validated against country rules' },
  { key: 'date', label: 'Date / time', hint: 'validated against accepted formats' },
  { key: 'amount', label: 'Amount', hint: 'must be a non-negative number' },
  { key: 'email', label: 'Email', hint: 'basic RFC-ish format check' },
  { key: 'payment', label: 'Payment mode', hint: 'must be in the allowed set' },
]

const HEADER_HINTS = {
  id: [/order.*id/i, /\bid\b/i, /txn/i, /transaction.*id/i, /invoice/i],
  phone: [/phone/i, /mobile/i, /contact/i, /\bmsisdn\b/i, /\btel\b/i],
  date: [/date/i, /time/i, /\bts\b/i, /timestamp/i, /created/i],
  amount: [/amount/i, /price/i, /total/i, /value/i, /\bamt\b/i],
  email: [/email/i, /e-mail/i, /\bmail\b/i],
  payment: [/payment/i, /pay.*mode/i, /method/i, /\bmode\b/i],
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

export const defaultPaymentModes = ['Card', 'UPI', 'NetBanking', 'Wallet', 'COD', 'PayNow']

// Validate one row against the mapping + config. Returns:
//   { valid, errors:[{field,message}], cleaned:{...}, raw }
function validateRow(row, cfg) {
  const { mapping, rules, defaultCountry, formats, paymentModes, requiredRoles } = cfg
  const errors = []
  const cleaned = { ...row }

  // Required (mapped) fields must be present.
  for (const role of requiredRoles) {
    const col = mapping[role]
    if (col && !String(row[col] ?? '').trim()) {
      errors.push({ field: col, message: `${role} is required but empty` })
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

  if (mapping.amount) {
    const col = mapping.amount
    const v = String(row[col] ?? '').trim()
    if (v) {
      const n = Number(v.replace(/[, ]/g, ''))
      if (!Number.isFinite(n)) errors.push({ field: col, message: `amount "${v}" is not a number` })
      else if (n < 0) errors.push({ field: col, message: `amount is negative` })
      else cleaned[col] = String(n)
    }
  }

  if (mapping.email) {
    const col = mapping.email
    const v = String(row[col] ?? '').trim()
    if (v && !EMAIL_RE.test(v)) errors.push({ field: col, message: `invalid email format` })
    else if (v) cleaned[col] = v.toLowerCase()
  }

  if (mapping.payment) {
    const col = mapping.payment
    const v = String(row[col] ?? '').trim()
    if (v) {
      const hit = paymentModes.find((m) => m.toLowerCase() === v.toLowerCase())
      if (!hit) errors.push({ field: col, message: `payment mode "${v}" not in allowed set` })
      else cleaned[col] = hit
    }
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
      const kind = e.message.split('—')[0].trim().replace(/"[^"]*"/g, '…')
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
