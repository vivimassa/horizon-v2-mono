import { z } from 'zod'

const pct = z.number().min(0).max(100)
const monthIndex = z.number().int().min(0).max(11)

export const planCreateSchema = z
  .object({
    name: z.string().min(1).max(80),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    sourceId: z.string().optional(), // clone settings from this plan
    year: z.number().int().optional(),
  })
  .strict()

export const planUpdateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    year: z.number().int().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict()

export const planSettingsSchema = z
  .object({
    wetLeaseActive: z.boolean().optional(),
    naOtherIsDrain: z.boolean().optional(),
  })
  .strict()

export const positionSettingsSchema = z
  .object({
    bhTarget: z.number().min(0).max(500).optional(),
    naSick: pct.optional(),
    naAnnual: pct.optional(),
    naTraining: pct.optional(),
    naMaternity: pct.optional(),
    naAttrition: pct.optional(),
    naOther: pct.optional(),
  })
  .strict()

export const fleetOverrideSchema = z
  .object({
    aircraftTypeIcao: z.string().min(1),
    monthIndex,
    planYear: z.number().int(),
    acCount: z.number().int().min(0),
  })
  .strict()

export const fleetUtilizationSchema = z
  .object({
    aircraftTypeIcao: z.string().min(1),
    dailyUtilizationHours: z.number().min(0).max(24),
  })
  .strict()

export const eventSchema = z
  .object({
    eventType: z.enum(['AOC', 'CUG', 'CCQ', 'ACMI', 'DRY', 'DOWNSIZE', 'RESIGN', 'DELIVERY']),
    monthIndex,
    planYear: z.number().int(),
    count: z.number().int().min(0),
    fleetIcao: z.string().nullable().optional(),
    positionName: z.string().nullable().optional(),
    leadMonths: z.number().int().min(0).max(36),
    notes: z.string().nullable().optional(),
  })
  .strict()
