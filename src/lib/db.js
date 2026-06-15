// Live SQL engine for the workbench, powered by sql.js (SQLite compiled to WASM).
// We load the dataset once, register a couple of MySQL-style helper functions
// (MONTHNAME / DAYNAME) so the live queries read close to their MySQL form, and
// expose a simple run() that returns { columns, rows }.
// Import the explicit UMD glue file (CJS) — the package's browser/module entry
// resolves to an ESM variant under Vite that lacks a usable default export.
import initSqlJs from 'sql.js/dist/sql-wasm.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { buildCustomers } from './sampleData.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function jsDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
}

let dbPromise = null

export function getDb() {
  if (!dbPromise) dbPromise = build()
  return dbPromise
}

async function build() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const db = new SQL.Database()

  // MySQL-style helpers so live queries mirror the canonical answers.
  db.create_function('MONTHNAME', (iso) => (iso ? MONTHS[jsDate(iso).getUTCMonth()] : null))
  db.create_function('DAYNAME', (iso) => (iso ? DAYS[jsDate(iso).getUTCDay()] : null))

  db.run(`CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    full_name   TEXT,
    email       TEXT,
    phone       TEXT,
    city        TEXT,
    signup_date TEXT
  );`)

  const customers = buildCustomers()
  const stmt = db.prepare('INSERT INTO customers VALUES (?,?,?,?,?,?)')
  for (const c of customers) {
    stmt.run([c.customer_id, c.full_name, c.email, c.phone, c.city, c.signup_date])
  }
  stmt.free()

  // orders table for the "customers who never placed an order" question.
  // ~70% of customers get 1-4 orders; the rest have none.
  db.run(`CREATE TABLE orders (
    order_id    INTEGER PRIMARY KEY,
    customer_id INTEGER,
    amount      REAL
  );`)
  const ostmt = db.prepare('INSERT INTO orders VALUES (?,?,?)')
  let oid = 5000
  customers.forEach((c) => {
    // deterministic: customers whose id % 10 < 7 have orders
    if (c.customer_id % 10 < 7) {
      const n = 1 + (c.customer_id % 4)
      for (let k = 0; k < n; k++) {
        ostmt.run([oid++, c.customer_id, 200 + ((c.customer_id * 37 + k * 91) % 4800)])
      }
    }
  })
  ostmt.free()

  return db
}

// Run SQL, return { columns, rows } for SELECT-style statements (last result set),
// or { columns: [], rows: [] } for DDL/DML. Throws on SQL error (surfaced in UI).
export async function run(sql) {
  const db = await getDb()
  const res = db.exec(sql)
  if (!res.length) return { columns: [], rows: [] }
  const last = res[res.length - 1]
  return { columns: last.columns, rows: last.values }
}

// Reset the in-memory DB (used after CREATE TABLE demos so re-runs are clean).
export function resetDb() {
  dbPromise = null
}
