/**
 * Inline SVG icon set for the workbench toolbar.
 * Supplies compact controls for canvas expansion, undo/redo, selection, snapping, deletion, rotation, and overlays.
 */

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

/** Renders the collapse-view icon used when the workbench canvas is expanded. */
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

/** Renders the expand-view icon used to focus the workbench canvas. */
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

/** Renders the undo icon for reverting the latest panel layout edit. */
export function UndoIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  )
}

/** Renders the redo icon for restoring a reverted panel layout edit. */
export function RedoIcon() {
  return (
    <svg {...svgProps}>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
  )
}

/** Renders the marquee-select icon for selecting multiple rooftop panels. */
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

/** Renders the snap icon for toggling panel alignment assistance. */
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

/** Renders the delete icon for removing selected panels from the layout. */
export function DeleteIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

/** Renders the rotate icon for toggling free rotation controls. */
export function RotateIcon() {
  return (
    <svg {...svgProps}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

/** Renders the layers icon for roof segment and imagery overlay controls. */
export function LayersIcon() {
  return (
    <svg {...svgProps}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
