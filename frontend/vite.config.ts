import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  // .env holds canonical (non-prefixed) secrets — see docs/TRD.md §14. Vite security
  // requires VITE_-prefixed names to reach client code, so we derive them here from
  // the canonical values and inject via process.env BEFORE Vite's env proxy is built.
  process.env.VITE_SUPABASE_URL = env.SUPABASE_URL ?? ''
  process.env.VITE_SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY ?? ''
  process.env.VITE_GOOGLE_API_KEY = env.GOOGLE_API_KEY ?? ''
  process.env.VITE_PDF_EXPORT_URL = env.PDF_EXPORT_URL ?? ''
  return {
    plugins: [react(), tailwindcss()],
    envDir: path.resolve(__dirname, '..'),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    server: {
      port: parseInt(env.FRONTEND_PORT) || 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${parseInt(env.BACKEND_PORT) || 3001}`,
          changeOrigin: true
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
      env: {
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key'
      }
    }
  }
})
