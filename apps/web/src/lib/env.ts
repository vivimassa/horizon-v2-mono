import { setApiBaseUrl } from '@skyhub/api'
import { validateClientEnv } from '@skyhub/env/client'

/**
 * Central env validation for the web app.
 * Imported as a side effect by the root layout — ensures the API base URL
 * is resolved and set exactly once, from validated environment variables.
 */
const env = validateClientEnv({
  API_URL: process.env.NEXT_PUBLIC_API_URL,
})

setApiBaseUrl(env.API_URL)

export { env }
