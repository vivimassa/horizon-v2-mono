// Central export for all FDTL framework templates.

import type { RuleTemplate, FDPTableTemplate, AugmentedTemplate } from './icao'
import { ICAO_RULES, ICAO_FDP_TABLE, ICAO_FDP_TABLES, ICAO_AUGMENTED } from './icao'
import { FAA_P117_OVERRIDES, FAA_TABLE_B, FAA_AUGMENTED } from './faa-p117'
import { EASA_OVERRIDES, EASA_SPECIFIC, EASA_TABLE_2, EASA_AUGMENTED } from './easa-oro-ftl'
import { TC_CAR700_OVERRIDES, TC_CAR700_FDP_TABLES, TC_CAR700_AUGMENTED } from './tc-car700'
import { CAAV_RULES, CAAV_FDP_TABLES, CAAV_AUGMENTED } from './caav-var15'

export type { RuleTemplate, FDPTableTemplate, AugmentedTemplate }
export type RuleOverride = { rule_code: string } & Partial<Omit<RuleTemplate, 'rule_code'>>

export interface FrameworkTemplate {
  rules: RuleTemplate[]
  fdpTables: FDPTableTemplate[]
  augmented: AugmentedTemplate[]
}

// ─── Override Application ────────────────────────────────────────────────────

export function applyOverrides(base: RuleTemplate[], overrides: Array<RuleOverride | RuleTemplate>): RuleTemplate[] {
  const result = base.map((r) => ({ ...r }))

  for (const override of overrides) {
    const existing = result.find((r) => r.rule_code === override.rule_code)
    if (existing) {
      Object.assign(existing, override)
    } else {
      const r = override as Partial<RuleTemplate>
      if (
        r.category &&
        r.subcategory &&
        r.label &&
        r.value != null &&
        r.value_type &&
        r.unit != null &&
        r.source &&
        r.sort_order != null
      ) {
        result.push(r as RuleTemplate)
      }
    }
  }

  return result
}

// ─── FDP Table Templates ─────────────────────────────────────────────────────

export function getFDPTableTemplates(frameworkCode: string): FDPTableTemplate[] {
  switch (frameworkCode) {
    case 'FAA_P117':
    case 'FAA_P121_FA':
      return [FAA_TABLE_B]

    case 'GACA_P117':
      // GACA mirrors FAA structure
      return [FAA_TABLE_B]

    case 'EASA_ORO_FTL':
    case 'UK_ORO_FTL':
    case 'UK_CAP371':
      return [EASA_TABLE_2]

    case 'TC_CAR700':
      // Canada has a different table structure — using ICAO as interim
      return TC_CAR700_FDP_TABLES.length > 0 ? TC_CAR700_FDP_TABLES : [ICAO_FDP_TABLE]

    case 'CASA_CAO48':
      // Australia Table 2.1 — TODO; using ICAO as interim
      return [ICAO_FDP_TABLE]

    case 'CAAS_ANR121':
      // Singapore Fifth Schedule Table A — TODO; using ICAO as interim
      return [ICAO_FDP_TABLE]

    case 'CAAV_REG':
      return CAAV_FDP_TABLES

    case 'ICAO_ANNEX6':
    case 'DGCA_CAR':
    case 'CAAM_CAD1901':
    case 'CAAT_FTL':
    case 'GCAA_SUBQ':
    case 'CUSTOM':
    default:
      return [ICAO_FDP_TABLE]
  }
}

// ─── Augmented Limits ────────────────────────────────────────────────────────

export function getAugmentedTemplates(frameworkCode: string): AugmentedTemplate[] {
  switch (frameworkCode) {
    case 'FAA_P117':
    case 'FAA_P121_FA':
    case 'GACA_P117':
      return FAA_AUGMENTED

    case 'EASA_ORO_FTL':
    case 'UK_ORO_FTL':
    case 'UK_CAP371':
      return EASA_AUGMENTED

    case 'TC_CAR700':
      return TC_CAR700_AUGMENTED.length > 0
        ? TC_CAR700_AUGMENTED
        : [
            {
              crew_count: 3,
              facility_class: 'CLASS_1',
              max_fdp_minutes: 900,
              display_value: '15:00',
              source: 'government',
              legal_reference: 'CAR 700.60',
            },
            {
              crew_count: 3,
              facility_class: 'CLASS_2',
              max_fdp_minutes: 840,
              display_value: '14:00',
              source: 'government',
              legal_reference: 'CAR 700.60',
            },
            {
              crew_count: 4,
              facility_class: 'CLASS_1',
              max_fdp_minutes: 1080,
              display_value: '18:00',
              source: 'government',
              legal_reference: 'CAR 700.60',
            },
            {
              crew_count: 4,
              facility_class: 'CLASS_2',
              max_fdp_minutes: 990,
              display_value: '16:30',
              source: 'government',
              legal_reference: 'CAR 700.60',
            },
          ]

    case 'CAAS_ANR121':
      return [
        {
          crew_count: 3,
          facility_class: 'CLASS_1',
          max_fdp_minutes: 900,
          display_value: '15:00',
          source: 'government',
          legal_reference: 'ANR-121 Fifth Schedule',
        },
        {
          crew_count: 4,
          facility_class: 'CLASS_1',
          max_fdp_minutes: 1080,
          display_value: '18:00',
          source: 'government',
          legal_reference: 'ANR-121 Fifth Schedule',
        },
      ]

    case 'CAAV_REG':
      return CAAV_AUGMENTED

    default:
      return []
  }
}

// ─── Full Framework Template ─────────────────────────────────────────────────

export function getTemplateForFramework(frameworkCode: string): FrameworkTemplate {
  switch (frameworkCode) {
    case 'FAA_P117':
    case 'FAA_P121_FA':
      return {
        rules: applyOverrides(ICAO_RULES, FAA_P117_OVERRIDES),
        fdpTables: getFDPTableTemplates(frameworkCode),
        augmented: getAugmentedTemplates(frameworkCode),
      }

    case 'EASA_ORO_FTL':
    case 'UK_ORO_FTL':
    case 'UK_CAP371':
      return {
        rules: applyOverrides([...applyOverrides(ICAO_RULES, EASA_OVERRIDES), ...EASA_SPECIFIC], []),
        fdpTables: getFDPTableTemplates(frameworkCode),
        augmented: getAugmentedTemplates(frameworkCode),
      }

    case 'TC_CAR700':
      return {
        rules: applyOverrides(ICAO_RULES, TC_CAR700_OVERRIDES),
        fdpTables: getFDPTableTemplates(frameworkCode),
        augmented: getAugmentedTemplates(frameworkCode),
      }

    case 'CAAV_REG':
      return {
        rules: CAAV_RULES,
        fdpTables: getFDPTableTemplates(frameworkCode),
        augmented: getAugmentedTemplates(frameworkCode),
      }

    default:
      return {
        rules: [...ICAO_RULES],
        fdpTables: getFDPTableTemplates(frameworkCode),
        augmented: getAugmentedTemplates(frameworkCode),
      }
  }
}

// Re-export ICAO_FDP_TABLES for backward compatibility with seed-operator-rules.ts
export { ICAO_FDP_TABLES, ICAO_AUGMENTED }
