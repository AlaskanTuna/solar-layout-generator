import { useState } from 'react'
import { requestPdfExportToken } from '@/api/projects'
import { notify } from '@/components/ui/toastConfig'
import { useTheme } from '@/hooks/useTheme'

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function buildPdfFileName(projectName: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `Solar_Analysis_${sanitizeFileName(projectName) || 'Project'}_${date}.pdf`
}

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

export function useAnalysisPdf() {
  const [isExporting, setIsExporting] = useState(false)
  const { resolved: resolvedTheme } = useTheme()

  async function handleExportPdf(projectId: string, projectName: string) {
    const exportUrl = import.meta.env.VITE_PDF_EXPORT_URL
    if (!exportUrl) {
      notify.error('PDF export service is not configured')
      return
    }

    setIsExporting(true)
    try {
      const { token } = await requestPdfExportToken(projectId)
      const previewUrl = new URL(`/project/${projectId}/pdf-preview`, window.location.origin)
      previewUrl.searchParams.set('token', token)
      previewUrl.searchParams.set('theme', resolvedTheme)
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
