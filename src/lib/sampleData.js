// Deterministic sample datasets. The same `customers` data feeds the live SQL
// workbench and the "download sample" button, so what you query is what you get.
// Signup dates cluster around 16 Apr 2025 (the assignment's "today") so the
// 30/60-day and monthly queries return meaningful results.

// Small seeded PRNG (mulberry32) — deterministic across runs.
function rng(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CITIES = [
  ['Delhi', 34], ['Mumbai', 28], ['Bangalore', 24], ['Hyderabad', 16],
  ['Chennai', 12], ['Pune', 11], ['Kolkata', 9], ['Jaipur', 7],
  ['Ahmedabad', 6], ['Lucknow', 4],
]
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Diya', 'Ananya', 'Ishaan', 'Kabir', 'Saanvi', 'Riya', 'Arjun',
  'Meera', 'Rohan', 'Neha', 'Karan', 'Priya', 'Aman', 'Sneha', 'Rahul', 'Pooja', 'Varun',
  'Isha', 'Nikhil', 'Tara', 'Dev', 'Anjali']
const LAST = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Gupta', 'Iyer', 'Khan', 'Singh', 'Bose',
  'Mehta', 'Kapoor', 'Rao', 'Joshi', 'Das']
const DOMAINS = ['gmail.com', 'gmail.com', 'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com']

function pickWeighted(rand, pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let x = rand() * total
  for (const [v, w] of pairs) {
    if ((x -= w) <= 0) return v
  }
  return pairs[0][0]
}

// Build the customers dataset (array of objects with the assignment's columns).
export function buildCustomers(count = 160) {
  const rand = rng(20250416)
  const today = new Date(Date.UTC(2025, 3, 16)) // 16 Apr 2025
  const rows = []
  for (let i = 1; i <= count; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)]
    const last = LAST[Math.floor(rand() * LAST.length)]
    const city = pickWeighted(rand, CITIES)
    // Signups spread across the prior ~170 days, denser near "today".
    const daysAgo = Math.floor(Math.pow(rand(), 1.6) * 170)
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - daysAgo)
    const signup = d.toISOString().slice(0, 10)
    const domain = DOMAINS[Math.floor(rand() * DOMAINS.length)]
    const handle = `${first}.${last}${i}`.toLowerCase()
    const phone = `+91 ${['6', '7', '8', '9'][Math.floor(rand() * 4)]}${Math.floor(100000000 + rand() * 899999999)}`.slice(0, 18)
    rows.push({
      customer_id: i,
      full_name: `${first} ${last}`,
      email: `${handle}@${domain}`,
      phone,
      city,
      signup_date: signup,
    })
  }
  return rows
}

export const customerColumns = ['customer_id', 'full_name', 'email', 'phone', 'city', 'signup_date']

// A messy transactions dataset for the Part 4 validator demo: deliberately mixes
// valid rows with bad phones (wrong length / wrong country), bad dates, negative
// or non-numeric amounts, bad emails, unknown payment modes, and a duplicate id.
export function buildTransactions() {
  return [
    { order_id: 'ORD-1001', customer_name: 'Aarav Sharma', email: 'aarav@gmail.com', phone: '+91 9876543210', country: 'IN', order_date: '2025-04-10', product: 'Wireless Mouse', amount: '799',  payment_mode: 'UPI' },
    { order_id: 'ORD-1002', customer_name: 'Mei Lin',      email: 'mei.lin@gmail.com', phone: '+65 81234567',  country: 'SG', order_date: '2025-04-11', product: 'USB-C Cable',   amount: '12.50', payment_mode: 'Card' },
    { order_id: 'ORD-1003', customer_name: 'Rohan Das',    email: 'rohan@yahoo.com',   phone: '98765',         country: 'IN', order_date: '2025-04-12', product: 'Keyboard',      amount: '1499', payment_mode: 'NetBanking' },
    { order_id: 'ORD-1004', customer_name: 'Sara Tan',     email: 'sara[at]mail.com',  phone: '+65 8123 4567', country: 'SG', order_date: '11/04/2025', product: 'Monitor Stand', amount: '45',   payment_mode: 'PayNow' },
    { order_id: 'ORD-1005', customer_name: 'Karan Mehta',  email: 'karan@gmail.com',   phone: '+91 12345',     country: 'IN', order_date: '2025-13-40', product: 'Laptop Sleeve', amount: '-200', payment_mode: 'UPI' },
    { order_id: 'ORD-1006', customer_name: 'Priya Nair',   email: 'priya@gmail.com',   phone: '+91 8123456789', country: 'IN', order_date: '2025-04-09', product: 'Webcam',       amount: '2,499', payment_mode: 'Bitcoin' },
    { order_id: 'ORD-1007', customer_name: 'John Lee',     email: 'john@outlook.com',  phone: '+1 4155552671', country: 'US', order_date: '04/14/2025', product: 'Desk Lamp',     amount: '30',   payment_mode: 'Card' },
    { order_id: 'ORD-1008', customer_name: 'Aisha Khan',   email: 'aisha@gmail.com',   phone: '+971 501234567', country: 'AE', order_date: '2025-04-13', product: 'Power Bank',   amount: '120',  payment_mode: 'Wallet' },
    { order_id: 'ORD-1001', customer_name: 'Aarav Sharma', email: 'aarav@gmail.com',   phone: '+91 9876543210', country: 'IN', order_date: '2025-04-10', product: 'Wireless Mouse', amount: '799', payment_mode: 'UPI' },
    { order_id: 'ORD-1009', customer_name: 'Tara Bose',    email: '',                  phone: '+44 7400123456', country: 'GB', order_date: '2025-04-08', product: 'Notebook',     amount: '8',    payment_mode: 'Card' },
    { order_id: 'ORD-1010', customer_name: 'Dev Rao',      email: 'dev@gmail.com',     phone: '+91 70123abcde', country: 'IN', order_date: '2025-04-07', product: 'Stylus Pen',   amount: '599',  payment_mode: 'COD' },
    { order_id: 'ORD-1011', customer_name: 'Lily Wong',    email: 'lily@gmail.com',    phone: '+65 12345678',  country: 'SG', order_date: '2025-04-06 14:30:00', product: 'Earbuds', amount: '89', payment_mode: 'PayNow' },
  ]
}

export const transactionColumns = ['order_id', 'customer_name', 'email', 'phone', 'country', 'order_date', 'product', 'amount', 'payment_mode']
