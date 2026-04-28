/** In-flight new-project state held across the MapPage → Workbench navigation. */
export type NewProjectDraft = {
  projectName: string
  locationId?: string
  phase?: 'search' | 'processing'
}

const STORAGE_KEY = 'solar-layout:new-project-draft'

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

/**
 * Reads the in-flight new-project draft from `sessionStorage`.
 * Returns `null` if storage is unavailable, the value is missing, or the stored shape is invalid.
 *
 * @returns Parsed {@link NewProjectDraft} or `null`
 */
export function readNewProjectDraft(): NewProjectDraft | null {
  if (!canUseSessionStorage()) return null

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<NewProjectDraft>
    if (!parsed || typeof parsed.projectName !== 'string' || parsed.projectName.trim().length === 0) {
      return null
    }

    return {
      projectName: parsed.projectName.trim(),
      locationId: typeof parsed.locationId === 'string' && parsed.locationId.length > 0 ? parsed.locationId : undefined,
      phase: parsed.phase === 'processing' ? 'processing' : 'search'
    }
  } catch {
    return null
  }
}

/**
 * Persists `draft` to `sessionStorage`. No-ops if storage is unavailable or `projectName` is empty.
 *
 * @param draft - Draft state to persist; whitespace in `projectName` is trimmed
 */
export function writeNewProjectDraft(draft: NewProjectDraft) {
  if (!canUseSessionStorage()) return

  const payload: NewProjectDraft = {
    projectName: draft.projectName.trim(),
    locationId: draft.locationId,
    phase: draft.phase ?? 'search'
  }

  if (!payload.projectName) return

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

/** Clears the new-project draft from `sessionStorage`. */
export function clearNewProjectDraft() {
  if (!canUseSessionStorage()) return
  window.sessionStorage.removeItem(STORAGE_KEY)
}
