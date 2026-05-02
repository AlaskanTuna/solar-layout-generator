import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { LoadingOverlay } from './components/ui/LoadingOverlay'
import { LandingPage } from './pages/LandingPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const FAQPage = lazy(() => import('./pages/FAQPage').then((m) => ({ default: m.FAQPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const WorkbenchPage = lazy(() => import('./pages/WorkbenchPage').then((m) => ({ default: m.WorkbenchPage })))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })))
const PdfPreviewPage = lazy(() => import('./pages/PdfPreviewPage').then((m) => ({ default: m.PdfPreviewPage })))

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
          <Route
            index
            element={
              <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="projects"
            element={
              <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
                <ProjectsPage />
              </Suspense>
            }
          />
          <Route
            path="faq"
            element={
              <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
                <FAQPage />
              </Suspense>
            }
          />
          <Route
            path="analytics"
            element={
              <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
                <AnalyticsPage />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="/settings"
          element={
            <AppLayout>
              <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
                <SettingsPage />
              </Suspense>
            </AppLayout>
          }
        />
        <Route
          path="/project/:projectId/map"
          element={
            <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
              <MapPage />
            </Suspense>
          }
        />
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
      <Route
        path="*"
        element={
          <Suspense fallback={<LoadingOverlay hints={PAGE_LOADING_HINTS} />}>
            <NotFoundPage />
          </Suspense>
        }
      />
    </Routes>
  )
}
