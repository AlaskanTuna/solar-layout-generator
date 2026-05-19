/**
 * Project route request validators.
 *
 * Re-exports shared project schemas so backend routes validate the same shapes
 * used by frontend and shared API types.
 */

import {
  createProjectRequestSchema,
  saveAnalysisRequestSchema,
  saveLayoutRequestSchema,
  updateLayoutPreferencesRequestSchema
} from '@shared/types'

/**
 * Validates the create-project request body.
 *
 * Requires the project name and linked location id defined by the shared API contract.
 */
export const createProjectSchema = createProjectRequestSchema
/**
 * Validates the save-layout request body.
 *
 * Enforces the shared edited-panel layout shape and optional selected panel model.
 */
export const saveLayoutSchema = saveLayoutRequestSchema
/**
 * Validates the save-analysis request body.
 *
 * Requires both persisted analysis configuration and computed analysis results.
 */
export const saveAnalysisSchema = saveAnalysisRequestSchema
/**
 * Validates the update-layout-preferences request body.
 *
 * Accepts the shared partial preference shape used for incremental UI changes.
 */
export const updateLayoutPreferencesSchema = updateLayoutPreferencesRequestSchema
