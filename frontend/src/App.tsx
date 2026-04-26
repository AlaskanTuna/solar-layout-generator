import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { LoadingOverlay } from './components/ui/LoadingOverlay'
import { LandingPage } from './pages/LandingPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import { SummaryPage } from './pages/SummaryPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { FAQPage } from './pages/FAQPage'
import { MapPage } from './pages/MapPage'
import { NotFoundPage } from './pages/NotFoundPage'

const WorkbenchPage = lazy(() =>
  import('./pages/WorkbenchPage').then((m) => ({ default: m.WorkbenchPage }))
)
const AnalysisPage = lazy(() =>
  import('./pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage }))
)
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
)
const PdfPreviewPage = lazy(() =>
  import('./pages/PdfPreviewPage').then((m) => ({ default: m.PdfPreviewPage }))
)

const PAGE_LOADING_HINTS = ['Loading page...']

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route
        path="/project/:projectId/pdf-preview"
        element={
          <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
            <PdfPreviewPage />
          </Suspense>
        }
      />
      <Route element={<ProtectedRoute />}>
        {/* Dashboard routes — share sidebar with INSIGHTS nav */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="summary" element={<SummaryPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="faq" element={<FAQPage />} />
          <Route
            path="analytics"
            element={
              <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
                <AnalyticsPage />
              </Suspense>
            }
          />
        </Route>
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
