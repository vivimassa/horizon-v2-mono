// ─── FDTL Runtime Engine — rule loader ────────────────────────────────────────
// Ported from v1 server-only module. Supabase calls replaced with TODO stubs.
// In v2 this will be wired to the appropriate data layer (local DB, API, etc.).

import type { SerializedRuleSet } from './engine-types'

export async function loadRuleSet(operatorId: string): Promise<SerializedRuleSet | null> {
  // TODO: Replace Supabase admin client with v2 data layer
  // const admin = createAdminClient()

  // 1. Operator scheme + framework
  // TODO: Fetch from fdtl_operator_schemes joined with fdtl_frameworks
  // const { data: scheme } = await admin
  //   .from('fdtl_operator_schemes')
  //   .select(`report_time_minutes, post_flight_minutes, framework_id, fdtl_frameworks (code, name)`)
  //   .eq('operator_id', operatorId)
  //   .neq('is_active', false)
  //   .maybeSingle()
  const scheme: any = null // TODO: wire to v2 data layer

  if (!scheme) return null

  const fw = scheme.fdtl_frameworks as unknown as { code: string; name: string } | null
  if (!fw) return null

  const frameworkId = scheme.framework_id as string

  // 2. Reporting times
  // TODO: Fetch from fdtl_reporting_times where operator_id = operatorId
  const rtRows: any[] = [] // TODO: wire to v2 data layer

  const reportingTimes = (rtRows ?? []).map((r: any) => ({
    key: `${r.time_type}|${r.route_type}|${r.column_key}`,
    minutes: r.minutes as number,
  }))

  // 3. FDP table meta (optional — reporting times still work without it)
  // TODO: Fetch from fdtl_fdp_tables where operator_id, framework_id, tab_key='fdp', crew_type='all'
  const tableRow: any = null // TODO: wire to v2 data layer

  // 4. FDP table cells (only if table exists)
  let fdpTable: SerializedRuleSet['fdpTable'] = null
  if (tableRow) {
    // TODO: Fetch from fdtl_fdp_table_cells where table_id = tableRow.id
    const cellRows: any[] = [] // TODO: wire to v2 data layer

    const cells = (cellRows ?? []).map((c: any) => ({
      key: `${c.row_key}|${c.col_key}`,
      minutes: c.value_minutes as number,
    }))

    fdpTable = {
      tableCode: tableRow.table_code as string,
      rowKeys: tableRow.row_keys as string[],
      rowLabels: tableRow.row_labels as string[],
      colKeys: tableRow.col_keys as string[],
      colLabels: tableRow.col_labels as string[],
      cells,
    }
  }

  // 5. Rule parameters — government first, then company (company overwrites if more restrictive logic handled in validator)
  // TODO: Fetch from fdtl_rule_parameters where operator_id, framework_id, is_active, crew_type in ['all','cockpit'], source_type in ['government','company']
  const ruleRows: any[] = [] // TODO: wire to v2 data layer

  // Build map: government first, then company overwrites
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

  // First pass: government
  for (const r of (ruleRows ?? []).filter((r: any) => r.source_type === 'government')) {
    ruleMap.set(r.rule_code, {
      code: r.rule_code,
      value: r.value,
      valueType: r.value_type,
      unit: r.unit ?? '',
      directionality: r.directionality ?? null,
      label: r.label,
      legalReference: r.legal_reference ?? null,
    })
  }
  // Second pass: company overwrites (always more restrictive per FDTL Rule Advisor design)
  for (const r of (ruleRows ?? []).filter((r: any) => r.source_type === 'company')) {
    ruleMap.set(r.rule_code, {
      code: r.rule_code,
      value: r.value,
      valueType: r.value_type,
      unit: r.unit ?? '',
      directionality: r.directionality ?? null,
      label: r.label,
      legalReference: r.legal_reference ?? null,
    })
  }

  // 6. Cabin crew rest table (e.g. CAAV Table 05)
  // TODO: Fetch from fdtl_fdp_tables where tab_key='cabin_crew'
  const cabinTableRow: any = null // TODO: wire to v2 data layer

  let cabinRestTable: SerializedRuleSet['cabinRestTable'] = null
  if (cabinTableRow) {
    // TODO: Fetch from fdtl_fdp_table_cells where table_id = cabinTableRow.id
    const cabinCells: any[] = [] // TODO: wire to v2 data layer

    cabinRestTable = {
      rowKeys: cabinTableRow.row_keys as string[],
      rowLabels: cabinTableRow.row_labels as string[],
      colKeys: cabinTableRow.col_keys as string[],
      colLabels: cabinTableRow.col_labels as string[],
      cells: (cabinCells ?? []).map((c: any) => ({
        key: `${c.row_key}|${c.col_key}`,
        minutes: c.value_minutes as number,
      })),
    }
  }

  // 6b. Cruise time deduction parameters (for cabin crew in-flight rest calculation)
  // TODO: Fetch from fdtl_rule_parameters where rule_code in ['REST_TAXI_OUT_DEDUCTION', ...]
  const deductionRows: any[] = [] // TODO: wire to v2 data layer

  const deductionMap = new Map<string, number>()
  for (const r of deductionRows ?? []) {
    const match = (r.value as string).trim().match(/^(\d+):(\d{2})$/)
    if (match) deductionMap.set(r.rule_code as string, parseInt(match[1]) * 60 + parseInt(match[2]))
  }

  const cruiseTimeDeductions: SerializedRuleSet['cruiseTimeDeductions'] = {
    taxiOutMinutes: deductionMap.get('REST_TAXI_OUT_DEDUCTION') ?? 10,
    taxiInMinutes: deductionMap.get('REST_TAXI_IN_DEDUCTION') ?? 10,
    climbMinutes: deductionMap.get('REST_CLIMB_DEDUCTION') ?? 30,
    descentMinutes: deductionMap.get('REST_DESCENT_DEDUCTION') ?? 30,
  }

  // 7. Augmented FDP limits
  // TODO: Fetch from fdtl_augmented_limits where operator_id, framework_id
  const augRows: any[] = [] // TODO: wire to v2 data layer

  // 8. Facility class labels (for display in checks + suggestions)
  // TODO: Fetch from fdtl_rest_facility_classes where framework_id
  const facilityRows: any[] = [] // TODO: wire to v2 data layer

  const facilityLabels = new Map<string, string>()
  for (const r of facilityRows ?? []) {
    facilityLabels.set(r.class_code as string, r.label as string)
  }

  const augmentedLimits = (augRows ?? []).map((r: any) => ({
    crewCount: r.crew_count as number,
    facilityClass: r.facility_class as string,
    facilityLabel: facilityLabels.get(r.facility_class as string) ?? (r.facility_class as string),
    maxFdpMinutes: r.max_fdp_minutes as number,
    legalReference: (r.legal_reference ?? null) as string | null,
  }))

  return {
    operatorId,
    frameworkCode: fw.code,
    frameworkName: fw.name,
    defaultReportMinutes: scheme.report_time_minutes as number,
    defaultDebriefMinutes: scheme.post_flight_minutes as number,
    reportingTimes,
    fdpTable,
    rules: Array.from(ruleMap.values()),
    augmentedLimits,
    cabinRestTable,
    cruiseTimeDeductions,
  }
}
