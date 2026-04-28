/** Render the stat card */
export function StatCard({
  icon,
  label,
  value,
  accent,
  bg
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  bg: string
}) {
  return (
    <div className="glass-card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`font-heading text-lg font-bold ${accent}`}>{value}</p>
      </div>
    </div>
  )
}
