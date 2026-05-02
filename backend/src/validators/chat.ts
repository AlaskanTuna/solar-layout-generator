import { z } from 'zod'

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
    page: z.enum(['workbench', 'analysis'])
  })
  .strict()

export type ChatRequest = z.infer<typeof chatRequestSchema>
