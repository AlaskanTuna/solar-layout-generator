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
const liveStateSchema = z
  .object({
    analysisConfig: storedAnalysisConfigSchema.nullable().optional(),
    analysisResults: analysisResultsSchema.nullable().optional(),
    editedLayout: z.array(panelEditSchema).nullable().optional(),
    layoutPreferences: layoutPreferencesSchema.nullable().optional()
  })
  .strict()

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
