// Vercel serverless function: POST /api/ai
// Thin adapter around the shared handler so the same logic runs in dev (Vite
// middleware) and in production (Vercel). The API key lives only in server env.
import { handleAi } from './handler.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  // Vercel parses JSON bodies automatically; fall back for safety.
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  const { status, json } = await handleAi(body || {})
  res.status(status).json(json)
}
