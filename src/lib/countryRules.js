// Configurable, country-code-driven phone rules.
//
// The assignment calls for "phone number validation based on country-specific
// rules (e.g., Singapore: 8 digits, India: 10 digits), driven by configurable
// country codes". Each rule is plain data so the UI can edit/add/remove them at
// runtime — nothing about the validator is hard-coded to a country.
//
//   dialCode      international prefix, used to auto-detect country from +NN... numbers
//   nationalDigits allowed lengths of the national (subscriber) number
//   startsWith     optional list of allowed leading digits of the national number
//                  (empty = any). Lets us reject e.g. Indian numbers not in 6-9.
export const defaultCountryRules = [
  { code: 'IN', name: 'India',          dialCode: '91',  nationalDigits: [10], startsWith: ['6', '7', '8', '9'], example: '+91 98765 43210' },
  { code: 'SG', name: 'Singapore',      dialCode: '65',  nationalDigits: [8],  startsWith: ['3', '6', '8', '9'], example: '+65 8123 4567' },
  { code: 'US', name: 'United States',  dialCode: '1',   nationalDigits: [10], startsWith: ['2', '3', '4', '5', '6', '7', '8', '9'], example: '+1 415 555 2671' },
  { code: 'AE', name: 'UAE',            dialCode: '971', nationalDigits: [9],  startsWith: ['5'],                example: '+971 50 123 4567' },
  { code: 'GB', name: 'United Kingdom', dialCode: '44',  nationalDigits: [10], startsWith: ['7'],                example: '+44 7400 123456' },
  { code: 'AU', name: 'Australia',      dialCode: '61',  nationalDigits: [9],  startsWith: ['4'],                example: '+61 4 1234 5678' },
]

// Strip everything that isn't a digit, but remember if the value was written in
// international form (leading + or 00) so we know whether a country prefix is present.
export function normalizeDigits(raw) {
  const s = String(raw ?? '').trim()
  const international = /^\+/.test(s) || /^00\d/.test(s)
  let digits = s.replace(/\D/g, '')
  if (international && digits.startsWith('00')) digits = digits.slice(2)
  return { digits, international }
}

// Find the rule whose dialCode prefixes the digit string (longest match wins, so
// +971 beats +9... style ambiguity). Only meaningful for international numbers.
function matchByDialCode(digits, rules) {
  const sorted = [...rules].sort((a, b) => b.dialCode.length - a.dialCode.length)
  return sorted.find((r) => digits.startsWith(r.dialCode)) || null
}

// Validate one phone value.
//   defaultCountry — the dataset's assumed country (code) for local-format numbers
// Returns { valid, normalized, country, reason }.
export function validatePhone(raw, rules, defaultCountry) {
  const value = String(raw ?? '').trim()
  if (!value) return { valid: false, normalized: '', country: null, reason: 'empty' }

  const { digits, international } = normalizeDigits(value)
  if (!digits) return { valid: false, normalized: '', country: null, reason: 'no digits' }
  if (/[a-zA-Z]/.test(value)) return { valid: false, normalized: '', country: null, reason: 'contains letters' }

  let rule = null
  let national = digits

  if (international) {
    rule = matchByDialCode(digits, rules)
    if (!rule) return { valid: false, normalized: '', country: null, reason: `unknown country code in "${value}"` }
    national = digits.slice(rule.dialCode.length)
  } else {
    rule = rules.find((r) => r.code === defaultCountry) || null
    if (!rule) return { valid: false, normalized: '', country: null, reason: 'no country rule selected' }
    // Tolerate a single leading 0 (national trunk prefix) and a bare country code.
    if (national.startsWith('0')) national = national.replace(/^0+/, '')
    if (national.startsWith(rule.dialCode) && national.length > Math.max(...rule.nationalDigits)) {
      national = national.slice(rule.dialCode.length)
    }
  }

  if (!rule.nationalDigits.includes(national.length)) {
    const want = rule.nationalDigits.join(' or ')
    return { valid: false, normalized: '', country: rule.code, reason: `${rule.name} needs ${want} digits, got ${national.length}` }
  }
  if (rule.startsWith.length && !rule.startsWith.includes(national[0])) {
    return { valid: false, normalized: '', country: rule.code, reason: `${rule.name} numbers can't start with ${national[0]}` }
  }

  return { valid: true, normalized: `+${rule.dialCode} ${national}`, country: rule.code, reason: '' }
}
