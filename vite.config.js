import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Client-only static site. sql.js ships a .wasm we load via ?url (see lib/db.js),
// so no special server config is needed and the build deploys to any static host.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  // sql.js ships as UMD/CJS; let Vite pre-bundle it so a default export is
  // synthesized via CJS interop (the wasm itself is loaded via ?url in db.js).
  optimizeDeps: { include: ['sql.js'] },
})
