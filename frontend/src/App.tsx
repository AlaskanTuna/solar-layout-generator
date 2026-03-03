import { Routes, Route } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import { MapPage } from './pages/MapPage'
import { WorkbenchPage } from './pages/WorkbenchPage'
import { AnalysisPage } from './pages/AnalysisPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/project/:projectId/map" element={<MapPage />} />
      <Route path="/project/:projectId/workbench" element={<WorkbenchPage />} />
      <Route path="/project/:projectId/analysis" element={<AnalysisPage />} />
    </Routes>
  )
}
