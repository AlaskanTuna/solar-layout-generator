/**
 * Compact summary card primitives for PDF analysis pages.
 * Used to present dense RM, kWh, kWp, and assumption values without live-page spacing.
 */

import { Card, CardContent } from '@/components/ui/card'

/**
 * Renders one small PDF metric tile with an optional supporting detail line.
 * @param props - Label, formatted value, and optional detail text.
 */
export function SummaryTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      {detail && <p className="text-[9px] text-muted-foreground">{detail}</p>}
    </div>
  )
}

/**
 * Renders a grouped PDF summary card with a fixed grid column count.
 * @param props - Card title, metric tiles, and optional 3/4/6-column layout selection.
 */
export function SummaryCard({
  title,
  tiles,
  columns = 3
}: {
  title: string
  tiles: { label: string; value: string; detail?: string }[]
  columns?: 3 | 4 | 6
}) {
  const gridClass = columns === 4 ? 'grid-cols-4' : columns === 6 ? 'grid-cols-6' : 'grid-cols-3'

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardContent className="p-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <div className={`grid gap-2 ${gridClass}`}>
          {tiles.map((tile) => (
            <SummaryTile key={tile.label} {...tile} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
