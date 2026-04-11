import { z } from 'zod'

const clientEnvSchema = z.object({
  API_URL: z.string().url().default('http://localhost:3002'),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

let _clientEnv: ClientEnv | null = null

export function validateClientEnv(raw: Record<string, string | undefined>): ClientEnv {
  if (_clientEnv) return _clientEnv

  const result = clientEnvSchema.safeParse(raw)
  if (!result.success) {
    console.error('\u274c Invalid client environment variables:', result.error.issues)
    throw new Error('Invalid client env')
  }

  _clientEnv = result.data
  return _clientEnv
}

export function getClientEnv(): ClientEnv {
  if (!_clientEnv) throw new Error('Call validateClientEnv() before getClientEnv()')
  return _clientEnv
}
