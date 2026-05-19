/**
 * Chat route request validators.
 *
 * Validates assistant messages, bounded conversation history, page context, and
 * optional live frontend state used to answer unsaved workbench questions.
 */

import { z } from 'zod'
import {
  analysisResultsSchema,
  layoutPreferencesSchema,
  panelEditSchema,
  storedAnalysisConfigSchema
} from '@shared/types'

// Optional snapshot of unsaved frontend state. The chat digest overlays these on top of the
// persisted Project row before generating the prompt, so Sol can answer questions about
// values the user is actively editing on AnalysisPage / WorkbenchPage but hasn't saved yet.
// Each field is independently optional — a workbench-only request only needs editedLayout
// and layoutPreferences, an analysis-only request only needs analysisConfig and analysisResults.
/**
 * Validates the optional unsaved frontend state merged into chat context.
 *
 * Each field is nullable and optional so workbench and analysis pages can send
 * only the slices they currently hold.
 */
const liveStateSchema = z
  .object({
    analysisConfig: storedAnalysisConfigSchema.nullable().optional(),
    analysisResults: analysisResultsSchema.nullable().optional(),
    editedLayout: z.array(panelEditSchema).nullable().optional(),
    layoutPreferences: layoutPreferencesSchema.nullable().optional()
  })
  .strict()

/**
 * Validates the chat request body sent to the solar assistant.
 *
 * Messages and history entries are capped at 4000 characters, history is capped
 * at 20 turns, and `page` limits the prompt context to supported app surfaces.
 */
export const chatRequestSchema = z
  .object({
    message: z.string().min(1).max(4000),
    history: z
      .array(
        z
          .object({
            role: z.enum(['user', 'model']),
            content: z.string().min(1).max(4000)
          })
          .strict()
      )
      .max(20),
    language: z.enum(['en', 'ms', 'zh']).default('en'),
    page: z.enum(['workbench', 'analysis']),
    liveState: liveStateSchema.optional()
  })
  .strict()

export type ChatRequest = z.infer<typeof chatRequestSchema>
export type ChatLiveState = z.infer<typeof liveStateSchema>
