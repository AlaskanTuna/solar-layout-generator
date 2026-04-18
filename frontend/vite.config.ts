import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  // Vite only exposes VITE_-prefixed vars to client code by default. We inject
  // the canonical (non-prefixed) names at build time so the root .env stays
  // free of duplicated keys — see docs/TRD.md §14 env matrix.
  const clientEnv = {
    'import.meta.env.GOOGLE_API_KEY': JSON.stringify(env.GOOGLE_API_KEY ?? ''),
    'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL ?? ''),
    'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY ?? ''),
    'import.meta.env.PDF_EXPORT_URL': JSON.stringify(env.PDF_EXPORT_URL ?? '')
  }
  return {
    plugins: [react(), tailwindcss()],
    envDir: path.resolve(__dirname, '..'),
    define: clientEnv,
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
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key'
      }
    }
  }
})
