import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenvExpand.expand(dotenv.config({ path: path.resolve(__dirname, '../../../.env') }))

const envSchema = z
  .object({
    PORT: z.coerce.number().optional(),
    BACKEND_PORT: z.coerce.number().default(3001),
    NODE_ENV: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.enum(['development', 'production', 'test']).default('development')
    ),
    SUPABASE_DATABASE_URL: z.string().min(1),
    GOOGLE_API_KEY: z.string().min(1),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    FRONTEND_URL: z.string().url().optional().default('http://localhost:5173'),
    PDF_TOKEN_SECRET: z.string().min(32),
    GEMINI_API_KEY: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(1).optional()),
    GOOGLE_CLOUD_PROJECT: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(1).optional()),
    GOOGLE_CLOUD_LOCATION: z.string().min(1).default('global'),
    CHAT_MODEL: z.string().min(1).default('gemini-3.1-flash-lite-preview')
  })
  .superRefine((value, ctx) => {
    if (!value.GEMINI_API_KEY && !value.GOOGLE_CLOUD_PROJECT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT must be set for the chat assistant.',
        path: ['GEMINI_API_KEY']
      })
    }
  })

const parsed = envSchema.parse(process.env)

/**
 * Parsed and validated runtime configuration
 */
export const env = {
  ...parsed,
  port: parsed.PORT ?? parsed.BACKEND_PORT
}
