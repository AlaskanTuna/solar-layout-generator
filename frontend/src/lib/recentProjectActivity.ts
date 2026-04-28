const STORAGE_KEY = 'slg-recent-project-activity'
const MAX_ENTRIES = 25

type RecentProjectActivity = {
  projectId: string
  visitedAt: string
}

function readEntries(): RecentProjectActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentProjectActivity[]
    return Array.isArray(parsed) ? parsed.filter((entry) => entry.projectId && entry.visitedAt) : []
  } catch {
    return []
  }
}

/**
 * Records that the user just opened `projectId`. Pinned to the front of the list,
 * deduplicates, and trims to 25 entries.
 *
 * @param projectId - Active project id; the literal `'new'` placeholder is ignored
 */
export function markProjectVisited(projectId: string) {
  if (!projectId || projectId === 'new') return
  const next = [
    { projectId, visitedAt: new Date().toISOString() },
    ...readEntries().filter((entry) => entry.projectId !== projectId)
  ].slice(0, MAX_ENTRIES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

/**
 * Last time `projectId` was opened, as an ISO 8601 string.
 *
 * @param projectId - Project id to look up
 * @returns ISO timestamp, or `null` when the project has never been visited
 */
export function getProjectLastVisitedAt(projectId: string): string | null {
  return readEntries().find((entry) => entry.projectId === projectId)?.visitedAt ?? null
}
