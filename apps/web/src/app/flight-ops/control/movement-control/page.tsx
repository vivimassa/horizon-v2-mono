/**
 * 2.1.1 Movement Control — forked from 1.1.2 Gantt Chart.
 * Uses MovementControlShell with OpsToolbar (OCC workflow)
 * while sharing canvas, stores, and all rendering with 1.1.2.
 */
import { MovementControlShell } from '@/components/flight-ops/gantt/movement-control-shell'

export default function MovementControlPage() {
  return (
    <div className="h-full">
      <MovementControlShell />
    </div>
  )
}
