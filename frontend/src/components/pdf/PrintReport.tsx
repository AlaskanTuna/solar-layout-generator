import type { ProjectResponse } from '@/api/projects'
import { PdfFixedFooter, PdfFixedHeader } from './PdfFixedChrome'
import { PrintPage1Workbench } from './PrintPage1Workbench'
import { PrintPage2Analysis } from './PrintPage2Analysis'

type PrintReportProps = {
  project: ProjectResponse
  /** ISO date string for when the seeded AFA and tariff were last verified */
  tariffEffectiveDate?: string | null
}

/**
 * Renders the multi-page PDF report
 * @param {PrintReportProps} props - Props for the component
 */
export function PrintReport({ project, tariffEffectiveDate = null }: PrintReportProps) {
  const generatedAt = new Date().toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  return (
    <div className="pdf-document">
      {/* Fixed chrome */}
      <PdfFixedHeader projectName={project.name} generatedAt={generatedAt} />
      <PdfFixedFooter imageryQuality={project.location?.imageryQuality ?? null} />
      {/* Page 1 */}
      <PrintPage1Workbench project={project} />
      {/* Page 2+ */}
      <PrintPage2Analysis project={project} tariffEffectiveDate={tariffEffectiveDate} />
    </div>
  )
}
