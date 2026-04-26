// Native (iOS/Android) Gantt route — direct mount. Skia native bindings
// don't require CanvasKit-Wasm. The web variant lives in gantt.web.tsx.
import { GanttShell } from '../../../src/components/gantt/gantt-shell'

export default function GanttScreen() {
  return <GanttShell />
}
