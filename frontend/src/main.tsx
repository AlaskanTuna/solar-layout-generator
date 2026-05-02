import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AppErrorBoundary } from './components/layout/AppErrorBoundary'
import { ChatProvider } from './components/chat/ChatProvider'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { LocaleProvider } from './hooks/useLocale'
import { App } from './App'
import './lib/i18n'
import './globals.css'

// Recharts' ResponsiveContainer + Radix dropdown's pointer-event tracking
// occasionally surface benign ResizeObserver loop warnings and null-reason
// rejections during dropdown open/close. They're harmless but get caught
// by MetaMask's SES lockdown logger and spam the console as
// `SES_UNCAUGHT_EXCEPTION: null`. Filter them at the source.
window.addEventListener('error', (event) => {
  if (event.message?.includes('ResizeObserver loop')) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
})
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = typeof reason?.message === 'string' ? reason.message : ''
  if (reason == null || message.includes('ResizeObserver loop')) {
    event.preventDefault()
  }
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tab focus and reconnect refetches were silently re-firing project, location and
      // quota requests on every tab switch. On a slow network this read as a freeze.
      // Hooks that need live data (e.g. useQuota) opt back in explicitly.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 60_000,
      retry: 1
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <ChatProvider>
                <LocaleProvider>
                  <App />
                  <Toaster position="bottom-center" toastOptions={{ duration: 4000 }} />
                </LocaleProvider>
              </ChatProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>
)
