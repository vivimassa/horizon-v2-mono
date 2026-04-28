/**
 * One-shot backfill — populates CrewRollingSnapshot with the last 13
 * month-ends so the auto-roster pre-filter has rolling-window history
 * the moment the FDTL integration ships.
 *
 * Usage:
 *   pnpm --filter server tsx src/backfill-crew-rolling-snapshot.ts \
 *     --operator=<operatorId> [--months=13]
 *
 * Idempotent: the worker upserts by (operatorId, crewId, snapshotIso) so
 * reruns of the same window only touch out-of-date rows.
 */
import mongoose from 'mongoose'
import { runDailyCrewActivityLog, type RunLog } from './jobs/tasks/daily-crew-activity-log.js'

function lastDayOfMonth(year: number, month1based: number): string {
  const d = new Date(Date.UTC(year, month1based, 0))
  return d.toISOString().slice(0, 10)
}

function buildMonthEndList(monthsBack: number): string[] {
  const now = new Date()
  const dates: string[] = []
  for (let i = 0; i < monthsBack; i++) {
    const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    dates.push(lastDayOfMonth(ref.getUTCFullYear(), ref.getUTCMonth() + 1))
  }
  // Also include yesterday so the freshest snapshot is current.
  const yest = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (!dates.includes(yest)) dates.push(yest)
  return [...new Set(dates)].sort()
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const flag = (name: string): string | null => {
    const found = args.find((a) => a.startsWith(`--${name}=`))
    return found ? found.slice(name.length + 3) : null
  }
  const operatorId = flag('operator')
  if (!operatorId) {
    console.error('Missing --operator=<operatorId>')
    process.exit(2)
  }
  const monthsBack = parseInt(flag('months') ?? '13', 10) || 13

  const mongoUrl = process.env.MONGODB_URI ?? process.env.MONGO_URL
  if (!mongoUrl) {
    console.error('Missing MONGODB_URI / MONGO_URL env')
    process.exit(2)
  }

  await mongoose.connect(mongoUrl)
  const dates = buildMonthEndList(monthsBack)
  console.log(`Backfilling ${dates.length} snapshot dates for operator ${operatorId}:`)
  for (const d of dates) console.log(`  • ${d}`)

  const log: RunLog = (level, message, pct) => {
    const tag = pct != null ? `[${pct}%] ` : ''
    if (level === 'error') console.error(tag + message)
    else if (level === 'warn') console.warn(tag + message)
    else console.log(tag + message)
  }

  const stats = await runDailyCrewActivityLog(operatorId, { snapshotDates: dates }, log)
  console.log('STATS', JSON.stringify(stats, null, 2))
  await mongoose.disconnect()
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
