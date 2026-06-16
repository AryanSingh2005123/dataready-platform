// Framework-agnostic AI handler, shared by the Vercel serverless function
// (api/ai.js) and the Vite dev middleware (vite.config.js). It talks to Claude
// via the official Anthropic SDK with the API key kept server-side, so the
// browser never sees it. With no key configured it returns 503 and the UI
// degrades gracefully.
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

// Schema of the in-browser dataset, given to Claude for text-to-SQL.
const SCHEMA = `Tables (SQLite dialect):
  customers(customer_id INTEGER, full_name TEXT, email TEXT, phone TEXT, city TEXT, signup_date TEXT 'YYYY-MM-DD')
  orders(order_id INTEGER, customer_id INTEGER, amount REAL)
Custom functions available: MONTHNAME(date), DAYNAME(date). "Today" is 2025-04-16.`

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const opts = { apiKey }
  if (process.env.ANTHROPIC_BASE_URL) opts.baseURL = process.env.ANTHROPIC_BASE_URL
  return new Anthropic(opts)
}

// Natural language → a single read-only SQLite SELECT over the schema above.
async function textToSql(anthropic, question) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      `You translate a question about a customer dataset into ONE read-only SQLite query.\n${SCHEMA}\n` +
      `Rules: return a single SELECT (or WITH ... SELECT) statement only — never INSERT/UPDATE/DELETE/DROP/PRAGMA/ATTACH. ` +
      `Prefer clear column aliases. If the question can't be answered from these tables, return a SELECT that returns an explanatory message.`,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'the SQLite SELECT statement' },
            explanation: { type: 'string', description: 'one sentence on what it does' },
          },
          required: ['sql', 'explanation'],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: 'user', content: question }],
  })
  const text = res.content.find((b) => b.type === 'text')?.text || '{}'
  return JSON.parse(text)
}

// Validation report stats → a short, plain-English data-quality summary.
async function summarize(anthropic, payload) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      `You are a data-quality analyst. Given a transaction-file validation summary, write a concise plain-text briefing ` +
      `(no markdown headers) for an operations team: 2-3 sentences on overall health, then a short prioritized list of the ` +
      `most impactful fixes. Be specific and practical; do not invent issues beyond the data given.`,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  })
  return res.content.find((b) => b.type === 'text')?.text?.trim() || ''
}

// body: { action: 'text_to_sql', question } | { action: 'summarize', report }
export async function handleAi(body) {
  const anthropic = client()
  if (!anthropic) {
    return { status: 503, json: { error: 'AI is not configured. Set ANTHROPIC_API_KEY on the server to enable AI features.' } }
  }
  try {
    if (body?.action === 'text_to_sql') {
      if (!body.question?.trim()) return { status: 400, json: { error: 'Missing question.' } }
      return { status: 200, json: await textToSql(anthropic, body.question.trim()) }
    }
    if (body?.action === 'summarize') {
      return { status: 200, json: { summary: await summarize(anthropic, body.report || {}) } }
    }
    return { status: 400, json: { error: 'Unknown action.' } }
  } catch (e) {
    return { status: 502, json: { error: `AI request failed: ${e?.message || e}` } }
  }
}
