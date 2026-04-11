import { z } from 'zod'

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  PORT: z.coerce.number().default(3002),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  CORS_ORIGIN: z.string().default('*'),

  ML_API_URL: z.string().url().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let _serverEnv: ServerEnv | null = null

export function validateServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv

  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    console.error('\u274c Invalid server environment variables:')
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  _serverEnv = result.data
  return _serverEnv
}

export function getServerEnv(): ServerEnv {
  if (!_serverEnv) throw new Error('Call validateServerEnv() before getServerEnv()')
  return _serverEnv
}
