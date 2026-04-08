import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { LoadingOverlay } from './components/ui/LoadingOverlay'
import { LandingPage } from './pages/LandingPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import { MapPage } from './pages/MapPage'
import { NotFoundPage } from './pages/NotFoundPage'

const WorkbenchPage = lazy(() =>
  import('./pages/WorkbenchPage').then((m) => ({ default: m.WorkbenchPage }))
)
const AnalysisPage = lazy(() =>
  import('./pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage }))
)

const PAGE_LOADING_HINTS = ['Loading page...']

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/project/:projectId/map" element={<MapPage />} />
        <Route
          path="/project/:projectId/workbench"
          element={
            <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
              <WorkbenchPage />
            </Suspense>
          }
        />
        <Route
          path="/project/:projectId/analysis"
          element={
            <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
              <AnalysisPage />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
