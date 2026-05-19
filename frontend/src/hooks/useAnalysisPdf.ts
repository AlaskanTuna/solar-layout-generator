/**
 * Analysis page PDF export hook.
 *
 * Drives the "Export PDF" flow on the analysis page:
 *   1. Run an optional `beforeExport` callback (used to save unsaved analysis
 *      results before triggering the render).
 *   2. Mint a short-lived PDF token from the backend.
 *   3. Build the `/project/:id/pdf-preview` URL with the token, theme, and
 *      locale baked in so the headless renderer matches the user's UI.
 *   4. POST that URL to the external PDF renderer service, download the
 *      resulting blob, and trigger a browser download.
 *
 * Localhost is blocked because the cloud renderer cannot reach `localhost`
 * directly — testing PDF export requires the deployed app.
 */

import { useState } from 'react'
import { requestPdfExportToken } from '@/api/projects'
import { notify } from '@/components/ui/toastConfig'
import { useTheme } from '@/hooks/useTheme'
import { useLocale } from '@/hooks/useLocale'

/** Strips characters that would break a download filename across OSes. */
function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Builds the `Solar_Analysis_<Project>_<YYYY-MM-DD>.pdf` download filename. */
function buildPdfFileName(projectName: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `Solar_Analysis_${sanitizeFileName(projectName) || 'Project'}_${date}.pdf`
}

/** Triggers a browser download for an in-memory blob, using a transient anchor. */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Returns `{ isExporting, handleExportPdf }` for wiring to the analysis
 * page's PDF button. `handleExportPdf(projectId, projectName, beforeExport?)`
 * runs the full export flow described in the file header.
 */
export function useAnalysisPdf() {
  const [isExporting, setIsExporting] = useState(false)
  const { resolved: resolvedTheme } = useTheme()
  const { locale } = useLocale()

  async function handleExportPdf(projectId: string, projectName: string, beforeExport?: () => Promise<void>) {
    const exportUrl = import.meta.env.VITE_PDF_EXPORT_URL
    if (!exportUrl) {
      notify.error('PDF export service is not configured')
      return
    }

    // Cloud PDF renderer cannot reach localhost; surface a helpful message
    // instead of letting the render silently 504.
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
      notify.error(
        'PDF export requires the deployed app - the cloud renderer cannot reach your local dev server. Test from https://solarsim.tech.'
      )
      return
    }

    setIsExporting(true)
    try {
      await beforeExport?.()
      const { token } = await requestPdfExportToken(projectId)
      const previewUrl = new URL(`/project/${projectId}/pdf-preview`, window.location.origin)
      previewUrl.searchParams.set('token', token)
      previewUrl.searchParams.set('theme', resolvedTheme)
      previewUrl.searchParams.set('locale', locale)
      if (import.meta.env.DEV) console.info('[PDF] previewUrl:', previewUrl.toString())

      const filename = buildPdfFileName(projectName)
      const response = await fetch(`${exportUrl}/api/pdf-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewUrl: previewUrl.toString(), filename })
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
        const header = body.error ?? `PDF export failed (${response.status})`
        throw new Error(body.message ? `${header}: ${body.message}` : header)
      }

      const blob = await response.blob()
      triggerDownload(blob, filename)
      notify.success(`PDF exported: ${filename}`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to export the PDF report')
    } finally {
      setIsExporting(false)
    }
  }

  return { isExporting, handleExportPdf }
}
