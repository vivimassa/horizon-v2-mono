// 4.1.6.2 Crew Schedule — Gantt Chart.
// Hosts the interactive drag-and-drop Gantt planner. Implementation still
// lives under `components/crew-ops/schedule/` — that folder name is kept
// stable on purpose (many imports reference it) while the route moves.
import { CrewScheduleShell } from '@/components/crew-ops/schedule/crew-schedule-shell'

export default function Page() {
  return <CrewScheduleShell />
}
