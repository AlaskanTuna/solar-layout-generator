import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenvExpand.expand(dotenv.config({ path: path.resolve(__dirname, '../../../.env') }))

const envSchema = z.object({
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
  PDF_TOKEN_SECRET: z.string().min(32)
})

const parsed = envSchema.parse(process.env)

export const env = {
  ...parsed,
  port: parsed.PORT ?? parsed.BACKEND_PORT
}
