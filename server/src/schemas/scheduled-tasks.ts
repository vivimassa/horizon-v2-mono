import { z } from 'zod'

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const scheduleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  timesOfDayLocal: z.array(z.string().regex(TIME_HHMM)).min(1).max(6),
  timezone: z.string().min(1),
})

export const notificationsSchema = z.object({
  onMissedStart: z.boolean(),
  onTerminated: z.boolean(),
  onError: z.boolean(),
  userIds: z.array(z.string()).default([]),
})

export const updateScheduledTaskSchema = z
  .object({
    active: z.boolean(),
    auto: z.boolean(),
    schedule: scheduleSchema,
    notifications: notificationsSchema,
    params: z.record(z.string(), z.unknown()),
  })
  .partial()

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

/** Trigger-time params for any task. Each runner picks the keys it cares about. */
export const runScheduledTaskSchema = z
  .object({
    fromIso: isoDate,
    toIso: isoDate,
    crewIds: z.array(z.string()).optional(),
    /** Force the slow full-recompute path; bypasses incremental fast-path. */
    fullRecompute: z.boolean().optional(),
  })
  .partial()

export type UpdateScheduledTaskInput = z.infer<typeof updateScheduledTaskSchema>
export type RunScheduledTaskInput = z.infer<typeof runScheduledTaskSchema>
export type SchedulePolicy = z.infer<typeof scheduleSchema>
