import { FdtlScheme } from '../models/FdtlScheme.js'
import { FdtlRule } from '../models/FdtlRule.js'
import { FdtlTable } from '../models/FdtlTable.js'
import { FDTL_FRAMEWORKS } from '../routes/fdtl.js'

/**
 * Assembles the operator's SerializedRuleSet — mirror of the GET /fdtl/rule-set
 * route handler, factored out so server-side code (pairing legality hook,
 * backfill script) can run the validator without an HTTP round-trip.
 *
 * Returns `null` when the operator has no FDTL scheme configured.
 */
export async function loadSerializedRuleSet(operatorId: string): Promise<unknown | null> {
  const scheme = await FdtlScheme.findOne({ operatorId }).lean()
  if (!scheme) return null

  const fw = FDTL_FRAMEWORKS.find((f) => f.code === scheme.frameworkCode)
  const [rules, tables] = await Promise.all([
    FdtlRule.find({ operatorId, frameworkCode: scheme.frameworkCode, isActive: { $ne: false } }).lean(),
    FdtlTable.find({ operatorId, frameworkCode: scheme.frameworkCode, isActive: { $ne: false } }).lean(),
  ])

  const reportingTimes = (scheme.reportingTimes ?? []).map((r) => ({
    key: `${r.timeType}|${r.routeType}|${r.columnKey}`,
    minutes: r.minutes as number,
  }))

  type RuleEntry = {
    code: string
    value: string
    valueType: string
    unit: string
    directionality: string | null
    label: string
    legalReference: string | null
  }
  const ruleMap = new Map<string, RuleEntry>()
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
}
