import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FdtlScheme } from '../models/FdtlScheme.js'
import { FdtlRule } from '../models/FdtlRule.js'
import { FdtlTable } from '../models/FdtlTable.js'
import { FdtlAuditLog } from '../models/FdtlAuditLog.js'
import { getTemplateForFramework } from '@skyhub/logic/src/fdtl/templates/index'

// ─── Framework Registry ────────────────────────────────────────────────────

export const FDTL_FRAMEWORKS = [
  { code: 'ICAO_ANNEX6', name: 'ICAO Annex 6', region: 'International', legalBasis: 'ICAO Annex 6', color: '#6b7280' },
  { code: 'CAAV_REG', name: 'CAAV VAR 15', region: 'Vietnam', legalBasis: 'CAAV VAR 15', color: '#dc2626' },
  { code: 'EASA_ORO_FTL', name: 'EASA ORO-FTL', region: 'Europe', legalBasis: 'EU 83/2014 ORO.FTL', color: '#2563eb' },
  {
    code: 'UK_ORO_FTL',
    name: 'UK ORO-FTL',
    region: 'United Kingdom',
    legalBasis: 'UK Reg (EU) 965/2012',
    color: '#1e40af',
  },
  { code: 'FAA_P117', name: 'FAA Part 117', region: 'United States', legalBasis: '14 CFR Part 117', color: '#0369a1' },
  {
    code: 'FAA_P121_FA',
    name: 'FAA Part 121 Subpart Q',
    region: 'United States',
    legalBasis: '14 CFR Part 121 Subpart Q',
    color: '#075985',
  },
  { code: 'TC_CAR700', name: 'Canada CAR Div VII', region: 'Canada', legalBasis: 'CAR SOR/2018-296', color: '#b91c1c' },
  {
    code: 'CASA_CAO48',
    name: 'CASA CAO 48',
    region: 'Australia',
    legalBasis: 'CAO 48.1 Instrument 2019',
    color: '#ca8a04',
  },
  {
    code: 'CAAS_ANR121',
    name: 'CAAS ANR-121',
    region: 'Singapore',
    legalBasis: 'ANR-121 Schedule 5',
    color: '#dc2626',
  },
  {
    code: 'DGCA_CAR',
    name: 'DGCA CAR-7-J',
    region: 'India',
    legalBasis: 'CAR Section 7 Series J Part IV',
    color: '#ea580c',
  },
  { code: 'CAAM_CAD1901', name: 'CAAM CAD 1901', region: 'Malaysia', legalBasis: 'CAD 1901-FTL', color: '#0284c7' },
  { code: 'CAAT_FTL', name: 'CAAT FTL', region: 'Thailand', legalBasis: 'ACAAT B.E. 2559', color: '#7c3aed' },
  { code: 'GCAA_SUBQ', name: 'GCAA CAR-OPS', region: 'UAE', legalBasis: 'GCAA CAR-OPS 1.1100', color: '#059669' },
  {
    code: 'GACA_P117',
    name: 'GACA GACAR',
    region: 'Saudi Arabia',
    legalBasis: 'GACAR Part 121 Subpart Q',
    color: '#16a34a',
  },
  { code: 'CUSTOM', name: 'Custom', region: 'Operator-defined', legalBasis: 'Operator OM-A', color: '#64748b' },
] as const

// ─── Tab Group Definitions ─────────────────────────────────────────────────

export const FDTL_TAB_GROUPS = [
  {
    key: 'fdp',
    label: 'Flight Duty Period',
    iconName: 'Clock',
    tabs: [
      { key: 'fdp', label: 'FDP Acclimatised' },
      { key: 'fdp_unacclim', label: 'FDP Unacclimatised' },
      { key: 'fdp_extended', label: 'FDP Extended' },
      { key: 'fdp_augmented', label: 'FDP Augmented' },
      { key: 'fdp_single_pilot', label: 'Single Pilot' },
    ],
  },
  {
    key: 'duty_rest',
    label: 'Duty & Rest',
    iconName: 'BedDouble',
    tabs: [
      { key: 'rest', label: 'Minimum Rest' },
      { key: 'split_duty', label: 'Split Duty' },
      { key: 'cumulative', label: 'Cumulative Limits' },
      { key: 'duty', label: 'Duty Limits' },
      { key: 'disruptive', label: 'Disruptive Schedules' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    iconName: 'Wrench',
    tabs: [
      { key: 'extension', label: 'Extensions' },
      { key: 'standby', label: 'Standby' },
      { key: 'mixed_ops', label: 'Mixed Operations' },
    ],
  },
  {
    key: 'crew',
    label: 'Crew Specifics',
    iconName: 'Users',
    tabs: [
      { key: 'cabin_crew', label: 'Cabin Crew' },
      { key: 'acclimatization', label: 'Acclimatisation' },
    ],
  },
  {
    key: 'operator',
    label: 'Operator Settings',
    iconName: 'Settings',
    tabs: [{ key: 'reporting_times', label: 'Reporting Times' }],
  },
] as const

// ─── Route Registration ────────────────────────────────────────────────────

export async function fdtlRoutes(app: FastifyInstance): Promise<void> {
  // ── Frameworks (static registry) ──

  app.get('/fdtl/frameworks', async () => {
    return FDTL_FRAMEWORKS
  })

  app.get('/fdtl/tab-groups', async () => {
    return FDTL_TAB_GROUPS
  })

  // ── Schemes ──

  app.get('/fdtl/schemes', async (req) => {
    const operatorId = req.operatorId
    return FdtlScheme.find({ operatorId }).lean()
  })

  app.get('/fdtl/schemes/:operatorId', async (req, reply) => {
    const { operatorId } = req.params as { operatorId: string }
    const doc = await FdtlScheme.findOne({ operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'No FDTL scheme found for this operator' })
    return doc
  })

  const schemeCreateSchema = z
    .object({
      operatorId: z.string().min(1),
      frameworkCode: z.string().min(1),
      cabinFrameworkCode: z.string().nullable().optional(),
      cabinCrewSeparateRules: z.boolean().optional(),
      reportTimeMinutes: z.number().int().min(0).optional(),
      postFlightMinutes: z.number().int().min(0).optional(),
      debriefMinutes: z.number().int().min(0).optional(),
      standbyResponseMinutes: z.number().int().min(0).optional(),
      frmsEnabled: z.boolean().optional(),
    })
    .strict()

  app.post('/fdtl/schemes', async (req, reply) => {
    const parsed = schemeCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const body = parsed.data
    const existing = await FdtlScheme.findOne({ operatorId: body.operatorId }).lean()
    if (existing) return reply.code(409).send({ error: 'FDTL scheme already exists for this operator' })

    const id = crypto.randomUUID()
    const doc = await FdtlScheme.create({ _id: id, ...body, createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  const schemeUpdateSchema = z
    .object({
      frameworkCode: z.string().min(1),
      cabinFrameworkCode: z.string().nullable(),
      cabinCrewSeparateRules: z.boolean(),
      reportTimeMinutes: z.number().int().min(0),
      postFlightMinutes: z.number().int().min(0),
      debriefMinutes: z.number().int().min(0),
      standbyResponseMinutes: z.number().int().min(0),
      augmentedComplementKey: z.string(),
      doubleCrewComplementKey: z.string(),
      frmsEnabled: z.boolean(),
      frmsApprovalReference: z.string().nullable(),
      woclStart: z.string(),
      woclEnd: z.string(),
    })
    .partial()
    .strict()

  app.patch('/fdtl/schemes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = schemeUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await FdtlScheme.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'FDTL scheme not found' })
    return doc
  })

  // ── Rules ──

  app.get('/fdtl/rules', async (req) => {
    const operatorId = req.operatorId
    const { frameworkCode, tabKey, crewType } = req.query as Record<string, string | undefined>
    const filter: Record<string, unknown> = { operatorId }
    if (frameworkCode) filter.frameworkCode = frameworkCode
    if (tabKey) filter.tabKey = tabKey
    if (crewType) filter.crewType = crewType
    return FdtlRule.find(filter).sort({ category: 1, subcategory: 1, sortOrder: 1 }).lean()
  })

  app.patch('/fdtl/rules/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>

    // Only allow value, source, verificationStatus, isActive updates
    const allowed = ['value', 'source', 'verificationStatus', 'isActive']
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    for (const key of allowed) {
      if (key in raw) updates[key] = raw[key]
    }

    // Track if value changed from template
    if ('value' in raw) {
      const existing = await FdtlRule.findById(id).lean()
      if (existing) {
        updates.isTemplateDefault = raw.value === existing.templateValue
        if (raw.value !== existing.templateValue) {
          updates.source = 'company'
        }
      }
    }

    const doc = await FdtlRule.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'FDTL rule not found' })
    return doc
  })

  // Reset rule to template default
  app.post('/fdtl/rules/:id/reset', async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await FdtlRule.findById(id).lean()
    if (!existing) return reply.code(404).send({ error: 'FDTL rule not found' })

    const doc = await FdtlRule.findByIdAndUpdate(
      id,
      {
        $set: {
          value: existing.templateValue,
          source: 'government',
          isTemplateDefault: true,
          updatedAt: new Date().toISOString(),
        },
      },
      { new: true },
    ).lean()
    return doc
  })

  // ── Tables ──

  app.get('/fdtl/tables', async (req) => {
    const operatorId = req.operatorId
    const { frameworkCode, tabKey, tableType } = req.query as Record<string, string | undefined>
    const filter: Record<string, unknown> = { operatorId }
    if (frameworkCode) filter.frameworkCode = frameworkCode
    if (tabKey) filter.tabKey = tabKey
    if (tableType) filter.tableType = tableType
    return FdtlTable.find(filter).sort({ tableCode: 1 }).lean()
  })

  // Update a single cell in a table
  app.patch('/fdtl/tables/:id/cells', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { rowKey, colKey, valueMinutes } = req.body as { rowKey: string; colKey: string; valueMinutes: number | null }

    const table = await FdtlTable.findById(id)
    if (!table) return reply.code(404).send({ error: 'FDTL table not found' })

    const cell = table.cells.find((c: any) => c.rowKey === rowKey && c.colKey === colKey)
    if (!cell) return reply.code(404).send({ error: `Cell ${rowKey}×${colKey} not found` })

    cell.valueMinutes = valueMinutes
    cell.displayValue =
      valueMinutes != null && valueMinutes >= 0
        ? `${Math.floor(valueMinutes / 60)}:${String(valueMinutes % 60).padStart(2, '0')}`
        : valueMinutes === -1
          ? 'N/A'
          : null
    cell.isTemplateDefault = valueMinutes === cell.templateValueMinutes
    cell.source = valueMinutes === cell.templateValueMinutes ? 'government' : 'company'

    table.updatedAt = new Date().toISOString()
    await table.save()
    return table.toObject()
  })

  // Reset all cells to template defaults
  app.post('/fdtl/tables/:id/reset', async (req, reply) => {
    const { id } = req.params as { id: string }
    const table = await FdtlTable.findById(id)
    if (!table) return reply.code(404).send({ error: 'FDTL table not found' })

    for (const cell of table.cells as any[]) {
      cell.valueMinutes = cell.templateValueMinutes
      cell.displayValue =
        cell.templateValueMinutes != null && cell.templateValueMinutes >= 0
          ? `${Math.floor(cell.templateValueMinutes / 60)}:${String(cell.templateValueMinutes % 60).padStart(2, '0')}`
          : cell.templateValueMinutes === -1
            ? 'N/A'
            : null
      cell.isTemplateDefault = true
      cell.source = 'government'
    }

    table.updatedAt = new Date().toISOString()
    await table.save()
    return table.toObject()
  })

  // ── Seed from Template ──

  app.post('/fdtl/seed', async (req, reply) => {
    const { operatorId, frameworkCode } = req.body as { operatorId: string; frameworkCode: string }
    if (!operatorId || !frameworkCode) {
      return reply.code(400).send({ error: 'operatorId and frameworkCode are required' })
    }

    // Validate framework
    const fw = FDTL_FRAMEWORKS.find((f) => f.code === frameworkCode)
    if (!fw) return reply.code(400).send({ error: `Unknown framework: ${frameworkCode}` })

    // Get template
    const template = getTemplateForFramework(frameworkCode)

    const now = new Date().toISOString()
    let rulesSeeded = 0
    let tablesSeeded = 0

    // Upsert scheme
    await FdtlScheme.findOneAndUpdate(
      { operatorId },
      {
        $set: { frameworkCode, updatedAt: now },
        $setOnInsert: { _id: crypto.randomUUID(), operatorId, createdAt: now },
      },
      { upsert: true, new: true },
    )

    // Delete existing rules and tables for this operator+framework to re-seed cleanly
    await FdtlRule.deleteMany({ operatorId, frameworkCode })
    await FdtlTable.deleteMany({ operatorId, frameworkCode })

    // Seed rules
    if (template.rules.length > 0) {
      const ruleRows = template.rules.map((r, i) => ({
        _id: crypto.randomUUID(),
        operatorId,
        frameworkCode,
        crewType: r.crew_type ?? 'all',
        category: r.category,
        subcategory: r.subcategory,
        ruleCode: r.rule_code,
        tabKey: r.tab_key ?? r.category,
        label: r.label,
        description: r.description ?? null,
        legalReference: r.legal_reference ?? null,
        value: String(r.value),
        valueType: r.value_type,
        unit: r.unit,
        directionality: r.directionality ?? null,
        source: r.source ?? 'government',
        templateValue: String(r.value),
        isTemplateDefault: true,
        verificationStatus: 'unverified',
        sortOrder: r.sort_order ?? i * 10,
        isActive: r.is_active ?? true,
        createdAt: now,
      }))
      await FdtlRule.insertMany(ruleRows)
      rulesSeeded = ruleRows.length
    }

    // Seed FDP tables
    if (template.fdpTables.length > 0) {
      const tableRows = template.fdpTables.map((t) => ({
        _id: crypto.randomUUID(),
        operatorId,
        frameworkCode,
        tableCode: t.table_code,
        tabKey: t.tab_key ?? 'fdp',
        label: t.label,
        legalReference: t.legal_reference ?? null,
        tableType: t.table_type ?? 'fdp_matrix',
        rowAxisLabel: t.row_axis_label ?? null,
        colAxisLabel: t.col_axis_label ?? null,
        rowKeys: t.row_keys,
        rowLabels: t.row_labels,
        colKeys: t.col_keys,
        colLabels: t.col_labels,
        cells: t.cells.map((c) => ({
          rowKey: c.row,
          colKey: c.col,
          valueMinutes: c.minutes,
          displayValue: c.display,
          source: c.source ?? 'government',
          templateValueMinutes: c.minutes,
          isTemplateDefault: true,
          notes: null,
        })),
        crewType: t.crew_type ?? 'all',
        appliesWhen: t.applies_when ?? null,
        isActive: true,
        createdAt: now,
      }))
      await FdtlTable.insertMany(tableRows)
      tablesSeeded = tableRows.length
    }

    // Seed augmented limits as a special table
    if (template.augmented.length > 0) {
      const facilityLabels: Record<string, string> = {
        CLASS_1: 'Class 1 (Bunk)',
        CLASS_2: 'Class 2 (Flat Seat)',
        CLASS_3: 'Class 3 (Reclining Seat)',
      }
      const crewCounts = [...new Set(template.augmented.map((a) => a.crew_count))].sort()
      const facilityClasses = [...new Set(template.augmented.map((a) => a.facility_class))]

      const augTable = {
        _id: crypto.randomUUID(),
        operatorId,
        frameworkCode,
        tableCode: `${frameworkCode}_AUGMENTED`,
        tabKey: 'fdp_augmented',
        label: 'Augmented Crew FDP Limits',
        legalReference: template.augmented[0]?.legal_reference ?? null,
        tableType: 'augmented_matrix',
        rowAxisLabel: 'Crew Count',
        colAxisLabel: 'Rest Facility Class',
        rowKeys: crewCounts.map(String),
        rowLabels: crewCounts.map((c) => `${c} Pilots`),
        colKeys: facilityClasses,
        colLabels: facilityClasses.map((f) => facilityLabels[f] || f),
        cells: template.augmented.map((a) => ({
          rowKey: String(a.crew_count),
          colKey: a.facility_class,
          valueMinutes: a.max_fdp_minutes,
          displayValue: a.display_value,
          source: a.source ?? 'government',
          templateValueMinutes: a.max_fdp_minutes,
          isTemplateDefault: true,
          notes: null,
        })),
        crewType: 'cockpit' as const,
        appliesWhen: null,
        isActive: true,
        createdAt: now,
      }
      await FdtlTable.create(augTable)
      tablesSeeded++
    }

    return { success: true, frameworkCode, rulesSeeded, tablesSeeded }
  })

  // ── Audit Log ──

  app.get('/fdtl/audit-log', async (req) => {
    const operatorId = req.operatorId
    const { limit } = req.query as { limit?: string }
    const maxResults = Math.min(parseInt(limit ?? '100') || 100, 500)
    return FdtlAuditLog.find({ operatorId }).sort({ changedAt: -1 }).limit(maxResults).lean()
  })

  // ── Serialized Rule Set ──
  // Assembles a full SerializedRuleSet in one call so clients (e.g. the
  // Crew Pairing workspace) can run FDTL legality checks entirely in-memory.
  app.get('/fdtl/rule-set', async (req, reply) => {
    const operatorId = req.operatorId
    const scheme = await FdtlScheme.findOne({ operatorId }).lean()
    if (!scheme) return reply.code(404).send({ error: 'No FDTL scheme configured for this operator' })

    const fw = FDTL_FRAMEWORKS.find((f) => f.code === scheme.frameworkCode)
    const [rules, tables] = await Promise.all([
      FdtlRule.find({ operatorId, frameworkCode: scheme.frameworkCode, isActive: { $ne: false } }).lean(),
      FdtlTable.find({ operatorId, frameworkCode: scheme.frameworkCode, isActive: { $ne: false } }).lean(),
    ])

    // Scheme → reporting times (flat list in SerializedRuleSet shape)
    const reportingTimes = (scheme.reportingTimes ?? []).map((r) => ({
      key: `${r.timeType}|${r.routeType}|${r.columnKey}`,
      minutes: r.minutes as number,
    }))

    // Rule map — government first, then company overrides (which are always
    // more restrictive by FDTL Rule Advisor design).
    const ruleMap = new Map<
      string,
      {
        code: string
        value: string
        valueType: string
        unit: string
        directionality: string | null
        label: string
        legalReference: string | null
      }
    >()
    for (const r of rules.filter((x) => x.source === 'government')) {
      ruleMap.set(r.ruleCode, {
        code: r.ruleCode,
        value: r.value,
        valueType: r.valueType,
        unit: r.unit ?? '',
        directionality: r.directionality ?? null,
        label: r.label,
        legalReference: r.legalReference ?? null,
      })
    }
    for (const r of rules.filter((x) => x.source === 'company')) {
      ruleMap.set(r.ruleCode, {
        code: r.ruleCode,
        value: r.value,
        valueType: r.valueType,
        unit: r.unit ?? '',
        directionality: r.directionality ?? null,
        label: r.label,
        legalReference: r.legalReference ?? null,
      })
    }

    // Helpers for cruise time deductions (parse "H:MM" strings → minutes)
    function hmmToMinutes(v?: string | null): number | null {
      if (!v) return null
      const m = v.trim().match(/^(\d+):(\d{2})$/)
      if (!m) {
        const n = parseInt(v, 10)
        return Number.isFinite(n) ? n : null
      }
      return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
    }
    const cruiseTimeDeductions = {
      taxiOutMinutes: hmmToMinutes(ruleMap.get('REST_TAXI_OUT_DEDUCTION')?.value) ?? 10,
      taxiInMinutes: hmmToMinutes(ruleMap.get('REST_TAXI_IN_DEDUCTION')?.value) ?? 10,
      climbMinutes: hmmToMinutes(ruleMap.get('REST_CLIMB_DEDUCTION')?.value) ?? 30,
      descentMinutes: hmmToMinutes(ruleMap.get('REST_DESCENT_DEDUCTION')?.value) ?? 30,
    }

    // FDP table (first table with tabKey 'fdp')
    const fdpTableDoc = tables.find((t) => t.tabKey === 'fdp')
    const fdpTable = fdpTableDoc
      ? {
          tableCode: fdpTableDoc.tableCode,
          rowKeys: fdpTableDoc.rowKeys ?? [],
          rowLabels: fdpTableDoc.rowLabels ?? [],
          colKeys: fdpTableDoc.colKeys ?? [],
          colLabels: fdpTableDoc.colLabels ?? [],
          cells: (fdpTableDoc.cells ?? [])
            .filter((c) => c.valueMinutes != null)
            .map((c) => ({ key: `${c.rowKey}|${c.colKey}`, minutes: c.valueMinutes as number })),
        }
      : null

    // Augmented limits — stored as an augmented_matrix table
    const augTableDoc = tables.find((t) => t.tableType === 'augmented_matrix' || t.tabKey === 'fdp_augmented')
    const facilityLabelMap: Record<string, string> = {}
    if (augTableDoc) {
      for (let i = 0; i < (augTableDoc.colKeys ?? []).length; i += 1) {
        const key = augTableDoc.colKeys?.[i]
        const label = augTableDoc.colLabels?.[i]
        if (key && label) facilityLabelMap[key] = label
      }
    }
    const augmentedLimits = augTableDoc
      ? (augTableDoc.cells ?? [])
          .filter((c) => c.valueMinutes != null)
          .map((c) => ({
            crewCount: parseInt(c.rowKey, 10),
            facilityClass: c.colKey,
            facilityLabel: facilityLabelMap[c.colKey] ?? c.colKey,
            maxFdpMinutes: c.valueMinutes as number,
            legalReference: augTableDoc.legalReference ?? null,
          }))
      : []

    // Cabin crew in-flight rest table
    const cabinTableDoc = tables.find((t) => t.tabKey === 'cabin_crew')
    const cabinRestTable = cabinTableDoc
      ? {
          rowKeys: cabinTableDoc.rowKeys ?? [],
          rowLabels: cabinTableDoc.rowLabels ?? [],
          colKeys: cabinTableDoc.colKeys ?? [],
          colLabels: cabinTableDoc.colLabels ?? [],
          cells: (cabinTableDoc.cells ?? [])
            .filter((c) => c.valueMinutes != null)
            .map((c) => ({ key: `${c.rowKey}|${c.colKey}`, minutes: c.valueMinutes as number })),
        }
      : null

    return {
      operatorId,
      frameworkCode: scheme.frameworkCode,
      frameworkName: fw?.name ?? scheme.frameworkCode,
      defaultReportMinutes: scheme.reportTimeMinutes ?? 45,
      defaultDebriefMinutes: scheme.debriefMinutes ?? scheme.postFlightMinutes ?? 30,
      reportingTimes,
      fdpTable,
      rules: Array.from(ruleMap.values()),
      augmentedLimits,
      cabinRestTable,
      cruiseTimeDeductions,
    }
  })
}
