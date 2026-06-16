// Framework-agnostic AI handler, shared by the Vercel serverless function
// (api/ai.js) and the Vite dev middleware (vite.config.js). The API key is kept
// server-side, so the browser never sees it. With no key configured it returns
// 503 and the UI degrades gracefully.
//
// Provider-agnostic and free to run:
//   • Anthropic (default)        — set ANTHROPIC_API_KEY  (model: claude-opus-4-8)
//   • Any OpenAI-compatible API  — set GROQ_API_KEY (free tier) or AI_API_KEY,
//                                  e.g. Groq / OpenRouter / Together / local Ollama
import Anthropic from '@anthropic-ai/sdk'

// Schema of the in-browser dataset, given to the model for text-to-SQL.
const SCHEMA = `Tables (SQLite dialect):
  customers(customer_id INTEGER, full_name TEXT, email TEXT, phone TEXT, city TEXT, signup_date TEXT 'YYYY-MM-DD')
  orders(order_id INTEGER, customer_id INTEGER, amount REAL)
Custom functions available: MONTHNAME(date), DAYNAME(date). "Today" is 2025-04-16.`

// Resolve which provider to use from the environment. Anthropic wins if set.
function provider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      kind: 'anthropic',
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
      baseURL: process.env.ANTHROPIC_BASE_URL,
    }
  }
  const key = process.env.GROQ_API_KEY || process.env.AI_API_KEY
  if (key) {
    return {
      kind: 'openai',
      key,
      baseURL: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
      model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
    }
  }
  return null
}

// One completion call across providers. Returns the raw text response.
//   json=true asks the provider to return a strict JSON object.
async function complete(cfg, { system, user, json }) {
  if (cfg.kind === 'anthropic') {
    const opts = { apiKey: process.env.ANTHROPIC_API_KEY }
    if (cfg.baseURL) opts.baseURL = cfg.baseURL
    const anthropic = new Anthropic(opts)
    const req = { model: cfg.model, max_tokens: 1024, system, messages: [{ role: 'user', content: user }] }
    if (json) {
      req.output_config = {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { sql: { type: 'string' }, explanation: { type: 'string' } },
            required: ['sql', 'explanation'],
            additionalProperties: false,
          },
        },
      }
    }
    const res = await anthropic.messages.create(req)
    return res.content.find((b) => b.type === 'text')?.text || ''
  }

  // OpenAI-compatible (Groq, OpenRouter, Together, Ollama, …)
  const body = {
    model: cfg.model,
    max_tokens: 1024,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  }
  if (json) body.response_format = { type: 'json_object' }
  const r = await fetch(`${cfg.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    throw new Error(`provider ${r.status}: ${detail.slice(0, 200)}`)
  }
  const data = await r.json()
  return data.choices?.[0]?.message?.content || ''
}

// Natural language → { sql, explanation } (a single read-only SELECT).
async function textToSql(cfg, question) {
  const system =
    `You translate a question about a customer dataset into ONE read-only SQLite query.\n${SCHEMA}\n` +
    `Return a JSON object with exactly two string keys: "sql" and "explanation". ` +
    `"sql" must be a single SELECT (or WITH ... SELECT) statement only — never INSERT/UPDATE/DELETE/DROP/PRAGMA/ATTACH, ` +
    `no trailing semicolon, with clear column aliases. "explanation" is one sentence on what it does.`
  const text = await complete(cfg, { system, user: question, json: true })
  return JSON.parse(text)
}

// Validation report stats → a short, plain-English data-quality briefing.
async function summarize(cfg, payload) {
  const system =
    `You are a data-quality analyst. Given a transaction-file validation summary, write a concise plain-text briefing ` +
    `(no markdown headers) for an operations team: 2-3 sentences on overall health, then a short prioritized list of the ` +
    `most impactful fixes. Be specific and practical; do not invent issues beyond the data given.`
  return (await complete(cfg, { system, user: JSON.stringify(payload), json: false })).trim()
}

// body: { action: 'text_to_sql', question } | { action: 'summarize', report }
export async function handleAi(body) {
  const cfg = provider()
  if (!cfg) {
    return { status: 503, json: { error: 'AI is not configured. Set ANTHROPIC_API_KEY (or GROQ_API_KEY) on the server to enable AI features.' } }
  }
  try {
    if (body?.action === 'text_to_sql') {
      if (!body.question?.trim()) return { status: 400, json: { error: 'Missing question.' } }
      return { status: 200, json: await textToSql(cfg, body.question.trim()) }
    }
    if (body?.action === 'summarize') {
      return { status: 200, json: { summary: await summarize(cfg, body.report || {}) } }
    }
    return { status: 400, json: { error: 'Unknown action.' } }
  } catch (e) {
    return { status: 502, json: { error: `AI request failed: ${e?.message || e}` } }
  }
}
