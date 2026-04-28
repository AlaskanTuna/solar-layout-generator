/**
 * Defines the NewProjectDraft type
 */
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
 * Defines the readNewProjectDraft function
 * @returns {NewProjectDraft} The resulting read new project draft value
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
 * Defines the writeNewProjectDraft function
 * @param {NewProjectDraft} draft - Value used for draft
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

/**
 * Defines the clearNewProjectDraft function
 */
export function clearNewProjectDraft() {
  if (!canUseSessionStorage()) return
  window.sessionStorage.removeItem(STORAGE_KEY)
}
