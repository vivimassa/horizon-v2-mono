/**
 * 4.1.8.1 Hotel Email — SMTP delivery adapter.
 *
 * Mirrors the asm-ssm-delivery noop pattern: in dev the noop adapter logs the
 * outbound email and stamps an external ref so the end-to-end held → sent
 * lifecycle exercises without live SMTP credentials. Real implementations
 * (nodemailer + Resend / SES / SendGrid) drop in behind a single env switch:
 *
 *   HOTEL_EMAIL_SMTP_ADAPTER = noop | nodemailer | resend | ses
 *
 * Completely separate from the ASM/SSM/MVT Type-B telex pipeline.
 */

export interface HotelEmailDeliveryRequest {
  emailId: string
  operatorId: string
  recipient: string
  subject: string
  body: string
  fromAddress: string | null
  replyTo: string | null
}

export interface HotelEmailDeliveryResult {
  ok: boolean
  externalRef?: string
  error?: string
  /** true → worker retries; false → terminal failure. */
  transient?: boolean
}

export interface HotelEmailDeliveryAdapter {
  readonly name: string
  send(req: HotelEmailDeliveryRequest): Promise<HotelEmailDeliveryResult>
}

const noopAdapter: HotelEmailDeliveryAdapter = {
  name: 'smtp-noop',
  async send(req) {
    console.log(
      `[hotel-email-noop] would deliver email ${req.emailId} → ${req.recipient}: "${req.subject.slice(0, 80)}"`,
    )
    return {
      ok: true,
      externalRef: `noop-${req.emailId}-${Date.now()}`,
    }
  },
}

let cachedAdapter: HotelEmailDeliveryAdapter | null = null

export function getHotelEmailAdapter(): HotelEmailDeliveryAdapter {
  if (cachedAdapter) return cachedAdapter
  const choice = (process.env.HOTEL_EMAIL_SMTP_ADAPTER ?? 'noop').toLowerCase()
  // Real adapters land in Phase 3.5 — wire nodemailer / Resend behind these
  // cases when SMTP credentials are provisioned for the operator.
  switch (choice) {
    case 'noop':
    default:
      cachedAdapter = noopAdapter
      break
  }
  return cachedAdapter
}
