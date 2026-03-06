import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
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
      globals: true
    }
  }
})
