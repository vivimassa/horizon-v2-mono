import type { TypeBEnvelope } from '@skyhub/logic/src/iata/types'

export interface MvtTransmissionRequest {
  envelope?: TypeBEnvelope
  rawMessage: string
  recipients: string[]
  operatorId: string
  messageId: string
}

export interface MvtTransmissionResult {
  ok: boolean
  externalMessageId?: string
  error?: string
}

export interface MvtTransmissionAdapter {
  readonly name: string
  send(request: MvtTransmissionRequest): Promise<MvtTransmissionResult>
}

const noopAdapter: MvtTransmissionAdapter = {
  name: 'noop',
  async send(req) {
    // Real gateway integration happens here — for now we accept and stamp an ID so the
    // release/transmit flow exercises end-to-end. Callers are expected to log this
    // result through the Fastify request logger rather than rely on stdout.
    return { ok: true, externalMessageId: `noop-${Date.now()}-${req.messageId.slice(0, 8)}` }
  },
}

// Future adapters — not wired. Left as shape markers so a real implementation can drop in.
// const sitaTypeBAdapter: MvtTransmissionAdapter = { name: 'sita', async send() { throw new Error('not implemented') } }
// const emailAdapter: MvtTransmissionAdapter = { name: 'email', async send() { throw new Error('not implemented') } }

export function getTransmissionAdapter(): MvtTransmissionAdapter {
  const kind = process.env.MVT_ADAPTER ?? 'noop'
  switch (kind) {
    case 'noop':
    default:
      return noopAdapter
  }
}
