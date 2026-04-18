import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getProjectForPdf, type ProjectResponse } from '@/api/projects'
import { PrintReport } from '@/components/pdf/PrintReport'

declare global {
  interface Window {
    __PDF_READY__?: boolean
    __PDF_ERROR__?: string
  }
}

function applyThemeFromParam(raw: string | null) {
  if (raw !== 'dark' && raw !== 'light') return
  document.documentElement.classList.toggle('dark', raw === 'dark')
}

export function PdfPreviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  // Sync theme before first paint so chart colors and card backgrounds match the app.
  applyThemeFromParam(searchParams.get('theme'))

  const [project, setProject] = useState<ProjectResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !token) {
      const msg = !projectId ? 'Missing project id' : 'Missing token'
      setError(msg)
      window.__PDF_ERROR__ = msg
      return
    }
    getProjectForPdf(projectId, token)
      .then(setProject)
      .catch((err: Error) => {
        const msg = err.message ?? 'Failed to load project data'
        setError(msg)
        window.__PDF_ERROR__ = msg
      })
  }, [projectId, token])

  useEffect(() => {
    if (!project) return
    // Wait for Recharts entry animations (~1.5s default) + final layout settlement.
    const timer = setTimeout(() => {
      window.__PDF_READY__ = true
    }, 2000)
    return () => clearTimeout(timer)
  }, [project])

  if (error) {
    return (
      <div className="pdf-error">
        <h1>PDF preview failed</h1>
        <p>{error}</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="pdf-loading">
        <p>Loading project…</p>
      </div>
    )
  }

  return <PrintReport project={project} />
}
