import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

/**
 * Defines the AppErrorBoundary class
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
