import type { ProjectResponse } from '@/api/projects'
import { PrintPage1Workbench } from './PrintPage1Workbench'
import { PrintPage2Analysis } from './PrintPage2Analysis'

export type CardId =
  | 'solar-verdict'
  | 'bill-comparison'
  | 'cumulative-savings'
  | 'system-cost'
  | 'financial-roadmap'
  | 'net-benefit'
  | 'month-table'
  | 'system-assumptions'

type PrintReportProps = {
  project: ProjectResponse
  cardOrder: CardId[]
}

export function PrintReport({ project, cardOrder }: PrintReportProps) {
  return (
    <div className="pdf-document">
      <PrintPage1Workbench project={project} />
      <PrintPage2Analysis project={project} cardOrder={cardOrder} />
    </div>
  )
}
