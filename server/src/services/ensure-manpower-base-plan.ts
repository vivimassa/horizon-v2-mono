import crypto from 'node:crypto'
import { ManpowerPlan } from '../models/ManpowerPlan.js'
import { ManpowerPlanSettings } from '../models/ManpowerPlanSettings.js'

/**
 * Idempotently upsert the Base Plan for an operator. Also ensures the plan-
 * level settings row exists. Safe to call on every boot + lazily.
 */
export async function ensureManpowerBasePlan(operatorId: string): Promise<string> {
  const existing = await ManpowerPlan.findOne({ operatorId, isBasePlan: true }).lean()
  if (existing) {
    const planId = existing._id as string
    await ensurePlanSettings(operatorId, planId)
    return planId
  }

  const now = new Date().toISOString()
  const planId = crypto.randomUUID()
  await ManpowerPlan.create({
    _id: planId,
    operatorId,
    name: 'Base Plan',
    color: '#0F766E', // teal-700
    isBasePlan: true,
    sortOrder: 0,
    year: new Date().getFullYear() + 1,
    createdAt: now,
    updatedAt: now,
  })
  await ensurePlanSettings(operatorId, planId)
  return planId
}

async function ensurePlanSettings(operatorId: string, planId: string): Promise<void> {
  const now = new Date().toISOString()
  await ManpowerPlanSettings.updateOne(
    { planId },
    {
      $setOnInsert: {
        _id: planId,
        planId,
        operatorId,
        wetLeaseActive: false,
        naOtherIsDrain: false,
        updatedAt: now,
      },
    },
    { upsert: true },
  )
}
