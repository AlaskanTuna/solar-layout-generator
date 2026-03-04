import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const envSchema = z.object({
  PORT: z.coerce.number().optional(),
  BACKEND_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_DATABASE_URL: z.string().min(1),
  GOOGLE_SOLAR_API_KEY: z.string().min(1),
  GOOGLE_MAPS_API_KEY: z.string().min(1),
  SUPABASE_PROJECT_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)
})

const parsed = envSchema.parse(process.env)

export const env = {
  ...parsed,
  port: parsed.PORT ?? parsed.BACKEND_PORT
}
