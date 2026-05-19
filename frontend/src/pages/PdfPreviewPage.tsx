/**
 * Renders the hidden PDF preview route used by browser-based report export.
 * It is reached at /project/:projectId/pdf-preview with a token and optional theme query parameter.
 * This page serves the print-render step after analysis export requests gather project and tariff data.
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getProjectForPdf, type ProjectResponse } from '@/api/projects'
import { getTariffConfig } from '@/api/tariff'
import { PrintReport } from '@/components/pdf/PrintReport'
import type { TariffConfigResponse } from '@shared/types'

declare global {
  interface Window {
    // The PDF automation process cannot observe React state directly, so it waits for this global readiness flag.
    __PDF_READY__?: boolean
    __PDF_ERROR__?: string
  }
}

/** Applies the requested print theme from the PDF preview query string before capture. */
function applyThemeFromParam(raw: string | null) {
  if (raw !== 'dark' && raw !== 'light') return
  document.documentElement.classList.toggle('dark', raw === 'dark')
}

/** Renders the PDF preview route used for browser-based report generation. */
export function PdfPreviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  applyThemeFromParam(searchParams.get('theme'))

  const [project, setProject] = useState<ProjectResponse | null>(null)
  const [tariff, setTariff] = useState<TariffConfigResponse | null>(null)
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
    getTariffConfig()
      .then(setTariff)
      .catch((err: Error) => {
        console.warn('[PdfPreview] tariff config fetch failed:', err.message)
      })
  }, [projectId, token])

  useEffect(() => {
    if (!project) return
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

  return <PrintReport project={project} tariffEffectiveDate={tariff?.effectiveDate ?? null} />
}
