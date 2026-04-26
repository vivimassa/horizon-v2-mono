import mongoose from 'mongoose'

let listenersBound = false

function bindConnectionEvents(): void {
  if (listenersBound) return
  listenersBound = true
  mongoose.connection.on('connected', () => {
    console.log('[mongo] connected:', mongoose.connection.name)
  })
  mongoose.connection.on('disconnected', () => {
    console.warn('[mongo] disconnected \u2014 driver will auto-retry')
  })
  mongoose.connection.on('reconnected', () => {
    console.log('[mongo] reconnected')
  })
  mongoose.connection.on('error', (err) => {
    console.error('[mongo] error:', err instanceof Error ? err.message : err)
  })
}

/**
 * Connect to MongoDB. Retries with backoff on initial failure instead of
 * exiting \u2014 Atlas cold starts and transient DNS failures shouldn't kill
 * the server before it has a chance to listen.
 */
export async function connectDB(uri: string): Promise<void> {
  bindConnectionEvents()

  const maxAttempts = 5
  let delayMs = 2_000
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 30_000,
        socketTimeoutMS: 60_000,
        maxPoolSize: 50,
      })
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[mongo] connect attempt ${attempt}/${maxAttempts} failed: ${msg}`)
      if (attempt === maxAttempts) throw err
      await new Promise((r) => setTimeout(r, delayMs))
      delayMs = Math.min(delayMs * 2, 30_000)
    }
  }
}
