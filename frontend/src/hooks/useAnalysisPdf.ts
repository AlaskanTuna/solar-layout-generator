import { useRef, useState } from 'react'
import html2pdf from 'html2pdf.js'
import { notify } from '@/components/ui/toastConfig'

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

export function useAnalysisPdf() {
  const reportRef = useRef<HTMLDivElement>(null)
  const simpleReportRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  async function handleExportPdf(viewMode: 'simple' | 'advanced', projectName: string) {
    const element = viewMode === 'simple' ? simpleReportRef.current : reportRef.current
    if (!element) return

    setIsExporting(true)
    try {
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: buildPdfFileName(projectName),
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(element)
        .save()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to export the PDF report')
    } finally {
      setIsExporting(false)
    }
  }

  return {
    reportRef,
    simpleReportRef,
    isExporting,
    handleExportPdf
  }
}
