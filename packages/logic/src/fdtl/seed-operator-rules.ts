// FDTL Template Seeder
// Populates an operator's rule parameters, FDP tables, and augmented limits
// from the framework template. Idempotent — safe to call multiple times.
//
// Ported from v1. All Supabase calls replaced with TODO stubs.
// In v2 this will be wired to the appropriate data layer (local DB, API, etc.).

import { getTemplateForFramework } from './templates/index'

// ─── Seeder Entry Point ──────────────────────────────────────────────────────

export async function seedOperatorRules(
  operatorId: string,
  frameworkCode: string,
): Promise<{ rulesSeeded: number; tablesSeeded: number; augmentedSeeded: number; error?: string }> {
  // TODO: Replace Supabase admin client with v2 data layer
  // const supabase = createAdminClient()

  // 1. Resolve framework ID
  // TODO: Fetch from fdtl_frameworks where code = frameworkCode
  const framework = null as { id: string } | null // TODO: wire to v2 data layer

  if (!framework) {
    return { rulesSeeded: 0, tablesSeeded: 0, augmentedSeeded: 0, error: `Framework not found: ${frameworkCode}` }
  }
  const frameworkId = framework.id

  // 2. Upsert operator scheme
  // TODO: Upsert into fdtl_operator_schemes { operator_id: operatorId, framework_id: frameworkId }

  // 3. Get template for this framework
  const template = getTemplateForFramework(frameworkCode)

  // 4. Seed rule parameters (upsert on operator_id + framework_id + rule_code + source)
  let rulesSeeded = 0
  for (const rule of template.rules) {
    // TODO: Upsert into fdtl_rule_parameters
    // {
    //   operator_id: operatorId, framework_id: frameworkId,
    //   category: rule.category, subcategory: rule.subcategory,
    //   rule_code: rule.rule_code, label: rule.label,
    //   value: rule.value, value_type: rule.value_type,
    //   unit: rule.unit, source: rule.source,
    //   legal_reference: rule.legal_reference ?? null,
    //   is_template_default: true, template_value: rule.value,
    //   sort_order: rule.sort_order, is_active: rule.is_active ?? true,
    //   directionality: rule.directionality ?? null,
    //   crew_type: rule.crew_type ?? 'all',
    // }
    // onConflict: 'operator_id,framework_id,rule_code,source,crew_type'
    rulesSeeded++ // TODO: only increment on success
  }

  // 5. Seed FDP tables + cells
  let tablesSeeded = 0
  for (const tpl of template.fdpTables) {
    // TODO: Upsert FDP table record into fdtl_fdp_tables
    // Then upsert cells in batches of 50 into fdtl_fdp_table_cells
    // {
    //   table_id, row_key: c.row, col_key: c.col,
    //   value_minutes: c.minutes, display_value: c.display,
    //   source: c.source, is_template_default: true,
    //   template_value_minutes: c.minutes,
    // }
    // onConflict: 'table_id,row_key,col_key'
    tablesSeeded++ // TODO: only increment on success
  }

  // 6. Seed augmented limits
  let augmentedSeeded = 0
  for (const aug of template.augmented) {
    // TODO: Upsert into fdtl_augmented_limits
    // {
    //   operator_id: operatorId, framework_id: frameworkId,
    //   crew_count: aug.crew_count, facility_class: aug.facility_class,
    //   max_fdp_minutes: aug.max_fdp_minutes, display_value: aug.display_value,
    //   min_inflight_rest_minutes: aug.min_inflight_rest_minutes ?? null,
    //   source: aug.source, legal_reference: aug.legal_reference ?? null,
    //   is_template_default: true, template_value_minutes: aug.max_fdp_minutes,
    // }
    // onConflict: 'operator_id,framework_id,crew_count,facility_class'
    augmentedSeeded++ // TODO: only increment on success
  }

  return { rulesSeeded, tablesSeeded, augmentedSeeded }
}
