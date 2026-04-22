// Legacy 4.1.6 route. Feature split into 4.1.6.1 Auto-Roster + 4.1.6.2
// Gantt Chart under `/crew-ops/control/crew-scheduling/`. Old deep-links
// redirect to the Gantt chart (primary child) so existing bookmarks,
// pairing-details "jump to schedule" links, and context-menu shortcuts
// keep working.
import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/crew-ops/control/crew-scheduling/gantt-chart')
}
