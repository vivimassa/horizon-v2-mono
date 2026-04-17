import type { AsmSsmConsumerDoc } from '../models/AsmSsmConsumer.js'

/**
 * 7.1.5.1 ASM/SSM Transmission — delivery adapters.
 *
 * Three shapes mirror the three delivery modes. pull_api is NOT an adapter:
 * those deliveries stay pending until the consumer calls the pull endpoint,
 * which marks them delivered directly (see routes/integration-pull.ts).
 *
 * Real integrations should drop in behind the env switches:
 *   ASM_SSM_SMTP_ADAPTER = noop | ses | sendgrid
 *   ASM_SSM_SFTP_ADAPTER = noop | real
 *
 * The noop adapters accept, log, and stamp an external ref so the end-to-end
 * flow exercises without requiring live credentials during development.
 */

export interface AsmSsmDeliveryRequest {
  messageId: string
  operatorId: string
  family: 'ASM' | 'SSM'
  type: string
  rawMessage: string
  consumer: AsmSsmConsumerDoc
}

export interface AsmSsmDeliveryResult {
  ok: boolean
  externalRef?: string
  error?: string
  transient?: boolean // true = will retry, false = terminal failure
}

export interface AsmSsmDeliveryAdapter {
  readonly name: string
  readonly mode: 'smtp' | 'sftp'
  send(req: AsmSsmDeliveryRequest): Promise<AsmSsmDeliveryResult>
}

function substituteTemplate(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => ctx[k] ?? '')
}

// ── SMTP noop ─────────────────────────────────────────────
const smtpNoopAdapter: AsmSsmDeliveryAdapter = {
  name: 'smtp-noop',
  mode: 'smtp',
  async send(req) {
    const smtp = req.consumer.smtp as
      | {
          to?: string | null
          subjectTemplate?: string | null
          asAttachment?: boolean
        }
      | undefined
    if (!smtp?.to) {
      return { ok: false, error: 'smtp.to missing', transient: false }
    }
    const subject = substituteTemplate(smtp.subjectTemplate ?? '[{family}] {type} — {messageId}', {
      family: req.family,
      type: req.type,
      messageId: req.messageId,
    })
    console.log(
      `[asm-ssm-delivery][smtp-noop] → ${smtp.to} subject="${subject}" attach=${Boolean(smtp.asAttachment)} messageId=${req.messageId}`,
    )
    return { ok: true, externalRef: `smtp-noop-${Date.now()}-${req.messageId.slice(0, 8)}` }
  },
}

// ── SFTP noop ─────────────────────────────────────────────
const sftpNoopAdapter: AsmSsmDeliveryAdapter = {
  name: 'sftp-noop',
  mode: 'sftp',
  async send(req) {
    const sftp = req.consumer.sftp as
      | { host?: string | null; targetPath?: string | null; filenamePattern?: string | null }
      | undefined
    if (!sftp?.host) return { ok: false, error: 'sftp.host missing', transient: false }
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const filename = substituteTemplate(
      sftp.filenamePattern ?? '{operator}_{family}_{type}_{messageId}_{timestamp}.txt',
      {
        operator: req.operatorId,
        family: req.family,
        type: req.type,
        messageId: req.messageId,
        timestamp: ts,
      },
    )
    console.log(
      `[asm-ssm-delivery][sftp-noop] → ${sftp.host}:${sftp.targetPath ?? '/'}${filename} bytes=${req.rawMessage.length}`,
    )
    return { ok: true, externalRef: `sftp-noop-${Date.now()}-${req.messageId.slice(0, 8)}` }
  },
}

export function getSmtpAdapter(): AsmSsmDeliveryAdapter {
  const kind = process.env.ASM_SSM_SMTP_ADAPTER ?? 'noop'
  switch (kind) {
    case 'noop':
    default:
      return smtpNoopAdapter
  }
}

export function getSftpAdapter(): AsmSsmDeliveryAdapter {
  const kind = process.env.ASM_SSM_SFTP_ADAPTER ?? 'noop'
  switch (kind) {
    case 'noop':
    default:
      return sftpNoopAdapter
  }
}
