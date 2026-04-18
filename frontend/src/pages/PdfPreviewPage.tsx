import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getProjectForPdf, type ProjectResponse } from '@/api/projects'
import { PrintReport, type CardId } from '@/components/pdf/PrintReport'

declare global {
  interface Window {
    __PDF_READY__?: boolean
    __PDF_ERROR__?: string
  }
}

const VALID_CARD_IDS: CardId[] = [
  'solar-verdict',
  'bill-comparison',
  'cumulative-savings',
  'system-cost',
  'financial-roadmap',
  'net-benefit',
  'system-assumptions'
]
const DEFAULT_CARD_ORDER: CardId[] = ['solar-verdict', 'bill-comparison', 'system-cost', 'financial-roadmap']

function parseCardOrder(raw: string | null): CardId[] {
  if (!raw) return DEFAULT_CARD_ORDER
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is CardId => VALID_CARD_IDS.includes(s as CardId))
  return parts.length > 0 ? parts : DEFAULT_CARD_ORDER
}

export function PdfPreviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const cardOrder = parseCardOrder(searchParams.get('cardOrder'))

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
    // Wait for Recharts entry animations (~1.5s default) + Konva paint + final layout settlement.
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

  return <PrintReport project={project} cardOrder={cardOrder} />
}
