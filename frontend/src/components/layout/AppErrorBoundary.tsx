import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

const CHUNK_RECOVERY_KEY = 'app-chunk-recovery-ts'
const CHUNK_RECOVERY_WINDOW_MS = 30_000

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === 'ChunkLoadError') return true
  const message = error.message
  return (
    /Loading chunk \d+ failed/.test(message) ||
    /Failed to fetch dynamically imported module/.test(message) ||
    /Importing a module script failed/.test(message)
  )
}

/**
 * Top-level React error boundary mounted in `main.tsx`.
 * Catches rendering errors anywhere in the tree, logs them, and shows a recoverable
 * "Reload / Return to Dashboard" card instead of a blank screen.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[AppErrorBoundary] Unhandled application error', error)

    // Stale lazy-chunk recovery: when the browser's cached index.html points to chunk
    // hashes from a previous deploy, dynamic imports 404. Auto-reload once so users
    // don't have to think about it. Guarded by a 30 s sessionStorage flag so a real
    // chunk bug can't trap them in a reload loop.
    if (isChunkLoadError(error)) {
      try {
        const last = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) ?? '0')
        if (Date.now() - last > CHUNK_RECOVERY_WINDOW_MS) {
          window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()))
          window.location.reload()
        }
      } catch {
        // sessionStorage unavailable (private mode etc); user can still hit the manual Reload button.
      }
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleDashboardRedirect = () => {
    window.location.assign('/dashboard')
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-lg border-border bg-card/95 shadow-lg">
          <CardHeader className="space-y-3">
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              The app hit an unexpected error while loading your session or project data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reload the page to retry. If the issue persists, return to the dashboard and reopen the project.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={this.handleReload}>Reload</Button>
              <Button variant="outline" onClick={this.handleDashboardRedirect}>
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
