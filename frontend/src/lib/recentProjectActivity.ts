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
 * Defines the markProjectVisited function
 * @param {string} projectId - Project identifier
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
 * Computes the project last visited at value
 * @param {string} projectId - Project identifier
 * @returns {string} The requested project last visited at
 */
export function getProjectLastVisitedAt(projectId: string): string | null {
  return readEntries().find((entry) => entry.projectId === projectId)?.visitedAt ?? null
}
