import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only middleware that serves POST /api/ai using the same handler the Vercel
// serverless function uses, so AI features work under `npm run dev` too. The
// handler reads ANTHROPIC_API_KEY from process.env; we hydrate it from .env(.local)
// so a key in those files is picked up without exporting it manually.
function aiDevApi(mode) {
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL',
    'GROQ_API_KEY', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL']) {
    if (env[k] && !process.env[k]) process.env[k] = env[k]
  }
  return {
    name: 'ai-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed') }
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', async () => {
          let body = {}
          try { body = JSON.parse(raw || '{}') } catch {}
          const { handleAi } = await server.ssrLoadModule('/api/handler.js')
          const { status, json } = await handleAi(body)
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(json))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), aiDevApi(mode)],
  server: { port: 5174, strictPort: true },
  // sql.js ships as UMD/CJS; let Vite pre-bundle it so a default export is
  // synthesized via CJS interop (the wasm itself is loaded via ?url in db.js).
  optimizeDeps: { include: ['sql.js'] },
}))
