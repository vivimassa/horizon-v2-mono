# SkyHub Messaging Architecture — Master Plan

> Living tracker for ASM/SSM + MVT/LDM recipient architecture.
> Cross items off as they ship. Revisit whenever scope changes.
> Owner: @vivimassa. Last updated: 2026-04-17.

---

## 1. Problem we are solving

Two message families, two different patterns. Both currently blocked on lack of recipient infrastructure:

- **MVT/LDM (and DEP, ARR, CPM)** — per-flight operational messages produced in `Movement Control 2.1.1`, `Gantt Compose MVT`, and `Scheduling XL`. Sent to handlers, fuel, catering, ops. Per-station. Volatile.
- **ASM/SSM** — schedule change messages produced by `Gantt 1.1.2` and `Scheduling XL 1.1.1`. Distributed to GDS providers, codeshare partners, slot coordinators. Global. Stable.

## 2. Mental model (the thing to remember)

**MVT/LDM is PUSH.** We resolve recipients per flight leg and transmit to their inboxes (email / SITA / ACARS).

**ASM/SSM is OUTBOX-FIRST with configurable delivery per consumer.** All generated messages land in one outbox (single source of truth). Each whitelisted consumer declares its own delivery mode:

- `pull_api` — consumer calls our API with key (modern)
- `sftp` — we push files to their SFTP
- `smtp` — we email to their mailbox(es) (common for smaller vendors / legacy flows)

All three modes share the same outbox, audit trail, and consumption semantics. "Consumed" = delivery acknowledged (API 200, SFTP upload success, or SMTP accept). The operator sees one consumer list — never a per-airport recipient matrix.

**Recipients are never their own module.** They are attributes of something else:

| Category                                                  | Lives in                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Internal staff (SkyHub users: OCC, rostering, admin)      | `7.1.2 User List Maintenance`                                               |
| External staff (handlers, fuel, catering, cargo)          | `5.3 Ground Ops master data`                                                |
| Codeshare / wetlease partners                             | `5.1.6 Carrier Codes`                                                       |
| ASM/SSM consumers (GDS, partners, legacy SMTP recipients) | Whitelisted consumer records in `7.1.5.1` — each with its own delivery mode |
| Operator "always-CC" addresses                            | `7.1.1 Operator Profile`                                                    |

No single unified "Recipient List" page. Ever.

## 3. What AIMS got wrong (so we don't repeat it)

AIMS runs two contradictory mechanisms for ASM/SSM:

| Mechanism             | Location                                           | Purpose                             |
| --------------------- | -------------------------------------------------- | ----------------------------------- |
| Folder drop + pull    | `IATA ASM/SSM Message Configuration` → Storage tab | Generates files, vendors pull       |
| Email push via matrix | `Recipients Address List` → ASM/SSM column         | Emails to whoever ticked the column |

**Two mechanisms = users don't know which is authoritative.** Massive support burden.

**SkyHub does ONE thing:** outbox-and-pull only. No email push for ASM/SSM. No per-recipient ASM/SSM checkbox. The `Recipients Address List` concept goes away entirely.

## 4. Non-goals (things we are NOT building)

- Unified recipient list page like AIMS
- Per-recipient ASM/SSM email push
- Local-time option for ASM/SSM generation (Rule #8: UTC-only)
- IBM MQ integration (REST/SFTP only)
- Windows file share drop paths (S3 / object storage)
- VietJet-specific logic (multi-tenant / operator-agnostic by design)

---

## Phase 1 — Ground Ops master data skeleton

> Foundation. Everything downstream depends on this. **Start here.**

### 1.1 Schema design

- [ ] Decide: single `externalParties` collection vs per-type collections → **recommendation: single collection with `serviceType` discriminator**
- [ ] Define `ExternalParty` schema (handlers/fuel/catering/cargo)
- [ ] Define `StationAssignment` sub-schema (airport + effective dates)
- [ ] Define `Contact` sub-schema (role, email, SITA, phone, station)
- [ ] Document role enum: `ops`, `ramp`, `loadcontrol`, `duty`, `fuel_supervisor`, `catering_manager`, `cargo_ops`, `hangar`, `security`, `other`
- [ ] Add `operatorId` to all collections (Rule #9)
- [ ] Timestamps in UTC ms with `Utc` suffix (Rule #8)

### 1.2 Module 5.3.1 — Ground Handlers

- [ ] Create Mongoose model `ExternalParty`
- [ ] Create Fastify routes: GET list, GET detail, POST, PATCH, DELETE (soft)
- [ ] Server RBAC: admin-only write
- [ ] Web landing page: searchable table (company name, code, station count, contact count, active/inactive)
- [ ] Web detail page with tabs: **Overview | Stations | Contacts | Audit**
- [ ] Overview tab: company name, IATA/ICAO code, HQ country, active toggle, notes
- [ ] Stations tab: add/remove station assignments, effective date pickers (UTC)
- [ ] Contacts tab: per-station contact rows with role picker, email, SITA, phone
- [ ] Filter bar: station, role, active/inactive
- [ ] Bulk import from CSV
- [ ] Empty states, loading states, skeletons
- [ ] Design system compliance (shadows level 01+, accent usage 3×, SectionHeader, 13px min, glass on hero)

### 1.3 Module 5.3.2 — Fuel Agents

- [ ] Reuse 5.3.1 component with `serviceType: 'fuel'` preset
- [ ] Fuel-specific role preset: `fuel_supervisor`, `ops`, `duty`

### 1.4 Module 5.3.3 — Catering Agents

- [ ] Reuse 5.3.1 component with `serviceType: 'catering'` preset

### 1.5 Module 5.3.4 — Cargo Agents

- [ ] Reuse 5.3.1 component with `serviceType: 'cargo'` preset

### 1.6 Unified External Staff Directory (optional polish)

- [ ] Top-level 5.3 landing page: cross-cutting search across all 4 types
- [ ] Filters: `serviceType`, station, company, role
- [ ] Deep-links into 5.3.1–5.3.4 detail pages

### 1.7 Verification

- [ ] Seed data: 3 test handlers × 5 stations × 10 contacts each
- [ ] Multi-tenant test: `operatorId` isolation across two tenants
- [ ] `/code-review` run passes
- [ ] `/verify` build/types/tests pass
- [ ] Design review vs CLAUDE.md visual polish checklist

---

## Phase 2 — MVT/LDM routing

> Wire Ground Ops master data into message transmission.

### 2.1 Role → Message type mapping

- [ ] Design mapping UI inside `7.1.5.2 ACARS/MVT/LDM Transmission`
- [ ] Seed default mapping:
  - `MVT` → origin `handler.ops + handler.ramp`, dest `handler.ops + handler.ramp`, + Ops CC
  - `LDM` → origin `handler.loadcontrol`
  - `CPM` → origin `handler.loadcontrol`, dest `handler.loadcontrol`
  - `DEP` → origin `handler.ops`, dest `handler.ops`
  - `ARR` → origin `handler.ops`, dest `handler.ops`
- [ ] UI to override per message type
- [ ] UI to enable/disable per message type globally
- [ ] Persist mapping as `messageTypeRoleMap` collection

### 2.2 Recipient resolver (server-side)

- [ ] Function signature: `resolveRecipients(flight, messageType) → Recipient[]`
- [ ] Resolve origin + destination station assignments
- [ ] Pull contacts matching role mapping
- [ ] Merge with Ops CC global list (Phase 4)
- [ ] De-duplicate by `email` / `sita` address
- [ ] Return with `source` attribution ("Menzies LHR ramp", "Ops CC", "Ad-hoc")
- [ ] Unit tests for: no handler, multi-handler, missing role, dedup collision

### 2.3 Composer preview UI

- [ ] Update `Movement Control 2.1.1` compose modal
- [ ] Update `apps/web/src/components/network/gantt/flight-information/compose-mvt-panel.tsx`
- [ ] Show resolved recipients as chips with source attribution
- [ ] Allow deselect per recipient before send
- [ ] Allow ad-hoc add (email or SITA)
- [ ] Persist ad-hoc adds in audit trail
- [ ] "Save as template" for ad-hoc additions (optional)

### 2.4 Transmission channels

- [ ] Email out via SES/SendGrid (already partially wired per recent commits — verify)
- [ ] SITA Type B out via Type B gateway provider (ARINC or SITA)
- [ ] ACARS out via ACARS provider webhook
- [ ] Fallback logic: if SITA fails, retry email, then surface error
- [ ] Rate limiting / backpressure per channel

### 2.5 Audit trail

- [ ] Collection `messageTransmissionLog` with per-send record
- [ ] Fields: `flightId`, `messageType`, `recipients[]`, `channel`, `timestamp`, `status`, `errorDetail?`
- [ ] Retry queue for failed transmissions (Redis-backed)
- [ ] UI to view transmission history per flight
- [ ] UI to manually retry a failed send

### 2.6 Auto-transmit banner integration

- [ ] Existing `auto-transmit-banner.tsx` and `mvt-auto-transmit.ts` — wire to resolver
- [ ] Ensure auto-transmit respects role mapping
- [ ] Auto-transmit toggle per message type

### 2.7 Verification

- [ ] End-to-end: compose MVT → resolve → preview → send → audit entry
- [ ] Multi-tenant recipient isolation test
- [ ] Edge case: flight with no handler assigned → fallback to Ops CC + UI warning
- [ ] Edge case: handler assigned but no contact with required role → warning
- [ ] Perf: resolver under 200ms P95 for typical flight

---

## Phase 3 — ASM/SSM Outbox (pull model)

> Rebuild `7.1.5.1 ASM/SSM Transmission` as outbox + consumers, not recipient matrix.

### 3.1 General Configuration (salvage from AIMS)

Keep these — they're legitimate generation settings:

- [ ] Toggle: Generate ASM messages
- [ ] Toggle: Generate SSM messages
- [ ] Toggle: Generate on schedule upload
- [ ] Toggle: Generate on playground commit
- [ ] Period filter: "for flight schedule changes dated between X and Y"
- [ ] Message type checkbox group: NEW, CNL, TIM, EQT, RPL, RRT, CON, ADM
- [ ] Priority: High/Medium/Low
- [ ] Force UTC (no Local toggle, per Rule #8)

### 3.2 Outbox storage

- [ ] MongoDB collection `asmSsmOutbox`
- [ ] Fields: `messageId`, `operatorId`, `type`, `family` (ASM/SSM), `content`, `generatedAtUtc`, `expiresAtUtc`, `status` (pending/consumed/expired), `consumedAtUtc?`, `consumedByConsumerId?`, `triggerSource`
- [ ] TTL index for auto-expiry (default 30 days)
- [ ] No Windows file share, no IBM MQ
- [ ] Optional: S3 archive for long-term

### 3.3 Consumer whitelisting

- [ ] New sub-module `7.1.5.1.1 Consumers`
- [ ] Collection `asmSsmConsumers`: name, contactEmail, `deliveryMode` (pull_api | sftp | smtp), mode-specific fields, ipAllowlist[]?, active, lastDeliveryAtUtc, totalConsumed, bounceCount
- [ ] UI: add/edit/disable consumer with mode picker
- [ ] Mode-specific form sections (pull_api: key + rotation; sftp: host/user/path; smtp: addresses/subject/format)
- [ ] Usage stats per consumer: last delivery, messages consumed, bytes transferred, recent failures
- [ ] Mark consumer inactive after N consecutive delivery failures (default 5)

### 3.4 Delivery — Pull API mode

- [ ] `GET /api/integration/asm-ssm/outbox` — authenticated by consumer API key header
- [ ] Returns pending messages for that consumer's operator
- [ ] Marks consumed on successful response delivery (acknowledge pattern)
- [ ] Query params: `?format=iata|json` (default `iata`), `?limit=100`
- [ ] Rate limiting per consumer
- [ ] Returns 401 on bad auth (no data leak)
- [ ] API key generation + one-time display (hash at rest)
- [ ] Key rotation UI

### 3.4.1 Delivery — SFTP mode

- [ ] Per-consumer: host, port, username, auth (password or key), target path, filename pattern
- [ ] Worker job: on new outbox message, push file to configured SFTP
- [ ] Mark consumed on SFTP `put` success; retry on transient failure (exponential backoff, 3 attempts)
- [ ] Filename convention: `{operator}_{family}_{type}_{messageId}_{yyyymmddhhmmss}.txt`

### 3.4.2 Delivery — SMTP mode

- [ ] Per-consumer: primary `to` address, optional `cc[]`, optional `bcc[]`
- [ ] Subject line template (supports placeholders: `{family}`, `{type}`, `{messageId}`)
- [ ] Attachment vs inline body toggle (some parsers require `.txt` attachment)
- [ ] Sender domain with DKIM/SPF/DMARC configured to avoid spam filters
- [ ] Mark consumed on SMTP provider accept (2xx from SES/SendGrid)
- [ ] Bounce webhook handler: increment `bounceCount`, mark inactive after threshold
- [ ] Distinct from operational email sender (separate IP/domain to protect sender reputation)

### 3.5 Audit backup

- [ ] Setting in 7.1.5.1: "Keep copy of consumed messages for audit"
- [ ] Retention period: 30/90/365/custom days
- [ ] Read-only collection `asmSsmAuditLog`
- [ ] UI: audit log viewer with filters (date range, type, consumer, status)
- [ ] Export to CSV for regulatory requests

### 3.6 Generation triggers (wire into existing features)

- [ ] `Gantt 1.1.2` schedule change → generate ASM (if enabled)
- [ ] `Scheduling XL 1.1.1` commit → generate ASM (if enabled)
- [ ] SSIM upload → generate SSM/ASM batch (if enabled)
- [ ] Playground commit → conditional generation per operator config

### 3.7 Verification

- [ ] E2E pull_api: schedule change → ASM lands in outbox → consumer pulls → marked consumed
- [ ] E2E sftp: schedule change → file lands on vendor SFTP → marked consumed
- [ ] E2E smtp: schedule change → email accepted by provider → marked consumed
- [ ] Bounce handling: SMTP bounce marks consumer inactive after threshold
- [ ] Audit backup: consumed message appears in audit log regardless of delivery mode
- [ ] Expiry: uncollected message expires after TTL
- [ ] Auth failure (pull_api): returns 401, no message data leaked
- [ ] Multi-tenant: consumer can only access their operator's messages
- [ ] Idempotency: double-pull does not return already-consumed messages
- [ ] Mixed fleet: one operator with all three delivery modes simultaneously

---

## Phase 4 — Ops CC global list

> Minimal. Defer until Phase 1–3 are stable.

- [ ] Add section to `7.1.1 Operator Profile`: "Always-CC addresses"
- [ ] Fields per row: email, description, enabled-for checkboxes (MVT / LDM / CPM / DEP / ARR; **NOT** ASM/SSM)
- [ ] Resolver (2.2) merges in Ops CC addresses for enabled message types
- [ ] Max 10 addresses per operator (soft limit)

---

## Phase 5 — Non-Crew Directory reconciliation

- [ ] Decide: merge `5.2.5 Non-Crew Directory` into `5.3`, or keep separate
- [ ] Recommendation: **keep separate** (jumpseat/APIS is a different domain)
- [ ] Cross-link from `5.3` contact detail if person also has APIS record

---

## Data model (canonical)

### Collection: `externalParties`

```ts
{
  _id: ObjectId,
  operatorId: string,
  serviceType: "handler" | "fuel" | "catering" | "cargo",
  companyName: string,
  companyCode: string,         // internal short code
  iataCode?: string,
  icaoCode?: string,
  hqCountry: string,           // ISO-3166
  active: boolean,
  stations: Array<{
    airportIcao: string,
    effectiveFromUtc: number,  // ms
    effectiveToUtc?: number,
    notes?: string
  }>,
  contacts: Array<{
    id: string,
    name: string,
    role: "ops" | "ramp" | "loadcontrol" | "duty"
        | "fuel_supervisor" | "catering_manager" | "cargo_ops"
        | "hangar" | "security" | "other",
    email?: string,
    sita?: string,
    phone?: string,
    stationIcao?: string,      // null = HQ-level contact
    active: boolean
  }>,
  createdAtUtc: number,
  updatedAtUtc: number
}
```

### Collection: `messageTypeRoleMap`

```ts
{
  _id: ObjectId,
  operatorId: string,
  messageType: "MVT" | "LDM" | "CPM" | "DEP" | "ARR",
  originRoles: string[],
  destinationRoles: string[],
  includeOpsCc: boolean,
  enabled: boolean,
  updatedAtUtc: number
}
```

### Collection: `asmSsmOutbox`

```ts
{
  _id: ObjectId,
  operatorId: string,
  messageId: string,           // unique
  family: "ASM" | "SSM",
  type: "NEW" | "CNL" | "TIM" | "EQT" | "RPL" | "RRT" | "CON" | "ADM",
  content: string,             // IATA-formatted
  generatedAtUtc: number,
  expiresAtUtc: number,
  status: "pending" | "consumed" | "expired",
  consumedAtUtc?: number,
  consumedByConsumerId?: string,
  triggerSource: "gantt" | "schedulingxl" | "ssim_upload" | "playground"
}
```

### Collection: `asmSsmConsumers`

```ts
{
  _id: ObjectId,
  operatorId: string,
  name: string,
  contactEmail: string,             // vendor's human contact, not delivery target
  deliveryMode: "pull_api" | "sftp" | "smtp",

  // pull_api mode
  apiKeyHash?: string,
  ipAllowlist?: string[],

  // sftp mode
  sftpHost?: string,
  sftpPort?: number,
  sftpUser?: string,
  sftpAuthType?: "password" | "key",
  sftpSecretRef?: string,           // reference to secret store, never raw
  sftpTargetPath?: string,
  sftpFilenamePattern?: string,

  // smtp mode
  smtpTo?: string,
  smtpCc?: string[],
  smtpBcc?: string[],
  smtpSubjectTemplate?: string,     // supports {family} {type} {messageId}
  smtpAsAttachment?: boolean,       // true = .txt attachment, false = inline body
  smtpBounceCount?: number,

  active: boolean,
  lastDeliveryAtUtc?: number,
  totalMessagesConsumed: number,
  consecutiveFailures: number,
  createdAtUtc: number
}
```

### Collection: `asmSsmAuditLog`

```ts
{
  _id: ObjectId,
  operatorId: string,
  messageId: string,
  family: "ASM" | "SSM",
  type: string,
  content: string,
  consumedAtUtc: number,
  consumedByConsumerId: string,
  expiresAtUtc: number         // retention window
}
```

### Collection: `messageTransmissionLog` (MVT/LDM audit)

```ts
{
  _id: ObjectId,
  operatorId: string,
  flightId: string,
  messageType: string,
  recipients: Array<{
    address: string,
    channel: "email" | "sita" | "acars",
    source: string,            // "Menzies LHR ramp", "Ops CC", "Ad-hoc", etc.
    deliveryStatus: "sent" | "failed" | "retrying"
  }>,
  sentAtUtc: number,
  status: "success" | "partial" | "failed",
  errorDetail?: string
}
```

---

## Open questions

- [ ] ACARS transmission: separate channel from MVT push, or reuse path?
- [ ] MVT preview: mandatory, or skippable via "auto-send" toggle?
- [ ] Codeshare partner ASM/SSM access: pull model (same API), or separate push?
- [ ] Contact sync with operator's HR/vendor database: manual only, or API?
- [ ] SITA Type B gateway provider: ARINC, SITA, or operator-provided?
- [ ] ASM/SSM audit retention: regulatory minimum per region (EU/US/ICAO)?
- [ ] Should consumer API support webhook push as alternative to pull?
- [ ] SMTP sender domain: shared with operational mail or dedicated subdomain (e.g. asm.skyhub.com) to protect sender reputation?
- [ ] SMTP bounce threshold default: 5 consecutive? Soft vs hard bounce handling?

---

## Progress log

| Date       | Phase | What shipped                     | Notes                                                                                                                     |
| ---------- | ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-17 | —     | Plan created                     | Initial version, awaiting Phase 1 start                                                                                   |
| 2026-04-17 | 3     | Added SMTP + SFTP delivery modes | Consumer record gains `deliveryMode` so small vendors can receive ASM/SSM by email; outbox remains single source of truth |
