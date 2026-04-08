const svgProps = {
  width: '16',
  height: '16',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

export function CollapseIcon() {
  return (
    <svg {...svgProps}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  )
}

export function ExpandIcon() {
  return (
    <svg {...svgProps}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  )
}

export function UndoIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  )
}

export function RedoIcon() {
  return (
    <svg {...svgProps}>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
  )
}

export function MarqueeIcon() {
  return (
    <svg {...svgProps}>
      <path d="M5 3h2" />
      <path d="M9 3h2" />
      <path d="M13 3h2" />
      <path d="M17 3h2" />
      <path d="M21 5v2" />
      <path d="M21 9v2" />
      <path d="M21 13v2" />
      <path d="M21 17v2" />
      <path d="M19 21h-2" />
      <path d="M15 21h-2" />
      <path d="M11 21h-2" />
      <path d="M7 21h-2" />
      <path d="M3 19v-2" />
      <path d="M3 15v-2" />
      <path d="M3 11v-2" />
      <path d="M3 7v-2" />
    </svg>
  )
}

export function SnapIcon() {
  return (
    <svg {...svgProps}>
      <path d="M6 15V9a6 6 0 0 1 12 0v6" />
      <path d="M6 9h4" />
      <path d="M14 9h4" />
      <path d="M6 15h4" />
      <path d="M14 15h4" />
    </svg>
  )
}

export function DeleteIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

export function RotateIcon() {
  return (
    <svg {...svgProps}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

export function LayersIcon() {
  return (
    <svg {...svgProps}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
