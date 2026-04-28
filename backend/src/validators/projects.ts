import {
  createProjectRequestSchema,
  saveAnalysisRequestSchema,
  saveLayoutRequestSchema,
  updateLayoutPreferencesRequestSchema
} from '@shared/types'

/**
 * Creates project request schema
 */
export const createProjectSchema = createProjectRequestSchema
/**
 * Saves layout request schema
 */
export const saveLayoutSchema = saveLayoutRequestSchema
/**
 * Saves analysis request schema
 */
export const saveAnalysisSchema = saveAnalysisRequestSchema
/**
 * Updates layout preferences request schema
 */
export const updateLayoutPreferencesSchema = updateLayoutPreferencesRequestSchema
