/**
 * One-off: generate a Crew Schedule 4.1.6 test-plan workbook.
 * Exposes the same test matrix that `docs/CREW_SCHEDULE_TEST_PLAN.md`
 * could carry, but as an .xlsx so testers can fill in the "Actual
 * Behavior" column inline.
 *
 * Run from repo root:   node scripts/gen-crew-schedule-test-plan.js
 * Output:               CREW_SCHEDULE_TEST_PLAN.xlsx
 */

const path = require('node:path')
const ExcelJS = require(path.join(__dirname, '..', 'node_modules', 'exceljs'))

// ── Test matrix ──────────────────────────────────────────────────────
// [action, where, expected]

const sections = [
  {
    title: 'Setup · load the schedule',
    color: 'FF3E7BFA',
    rows: [
      [
        'Open Crew Schedule',
        'Nav · Crew Ops → Control → Crew Schedule',
        'Page loads with the glass-style shell. Left filter panel visible. Canvas area shows EmptyPanel: "Configure filters on the left and click Go to load the crew schedule".',
      ],
      [
        'Pick a period and click Go',
        'Left filter panel · Period date pickers + Go button',
        'Runway loading animation plays for ≥3 s. Gantt renders: left panel with crew list, time-header strip (day labels with weekend shading), and pairing bars on the crew rows. Uncrewed tray docked at the bottom of the canvas.',
      ],
      [
        'Toggle right inspector',
        'Ribbon · Display section · Hide/Show button',
        'Right inspector (Duty/Assign/Bio/Expiry tabs) slides in/out. Canvas reclaims the space when hidden.',
      ],
    ],
  },
  {
    title: 'Phase 1 · Target-dispatched right-click menus',
    color: 'FF0E8A5B',
    rows: [
      [
        'Right-click on a pairing bar',
        'Gantt · any pairing bar',
        'Context menu opens at the cursor. Header caption: "Pairing". Items: Pairing details · Show legality (L) · Crew on same pairing (Phase 2) · View/edit memo (M) · Flight schedule changes (Phase 4) · Swap with… (S) · Duplicate to another crew… (Phase 2) · Unassign crew (Del) in red.',
      ],
      [
        'Right-click on an activity bar',
        'Gantt · colored activity bar (e.g. OFF, LEAVE)',
        'Header: "Activity". Items: Activity details · Edit times/notes (Phase 2) · Change code… (Phase 2) · Duplicate across dates… (Phase 2) · Delete activity (Del) in red.',
      ],
      [
        'Right-click an empty cell on a crew row',
        'Gantt · blank day on any crew row',
        'Header shows the ISO date. Items: Assign activity… (A) · Assign pairing… (Phase 2) · Copy previous day (Phase 2) · Assign series of duties… (Phase 2) · View/edit day memo (M) · Show legality (L).',
      ],
      [
        'Right-click a crew name',
        'Left panel · crew row text',
        'Header: "Crew". Items: Crew bio (B) · Expiry dates (E) · Show legality (L) · Crew memo (M) · Toggle published schedule (Phase 4) · Crew extra info (Phase 4) · Refresh this crew (R) · Call crew member (Deferred) · Exclude from view (H) in red.',
      ],
      [
        'Right-click the date header strip',
        'Gantt · the top 48 px row with day labels',
        'Header shows the ISO date. Items: Uncrewed duties for this date · Uncrewed-duty customization (Phase 3) · Group crew together… (Phase 3 / G) · Flight/Duty time totals (Phase 2 / T) · Show legality (Phase 2 / L).',
      ],
      ['Esc while menu is open', 'Keyboard', 'Menu closes. Selection (if any) untouched.'],
      ['Click outside menu', 'Anywhere outside the menu', 'Menu closes.'],
    ],
  },
  {
    title: 'Phase 2 · Range select, block ops, drag, swap',
    color: 'FFFF8800',
    rows: [
      [
        'Shift-drag across days on one crew row',
        'Gantt · Shift + click-and-drag on a blank row area',
        'Cursor becomes crosshair. Accent-tinted rectangle follows the drag, bounded to one row.',
      ],
      ['Release shift-drag', 'Gantt', 'Highlight persists. Range selection stored in the store.'],
      [
        'Right-click inside a range selection',
        'Gantt · inside the highlighted rectangle',
        'Header: "fromIso → toIso". Items: Assign series of duties… (A) · Copy/Move/Swap block (Phase 2 badges) · Show legality (Phase 2) · Delete N duties (Del) in red. Delete counts actual activities/assignments in the range.',
      ],
      [
        'Assign series of duties…',
        'Block menu item',
        'Inspector jumps to Assign tab showing header "Assign Series · N days" with the date range. Grouped activity picker lists codes (TRAINING etc.) with pill badges.',
      ],
      [
        'Pick an activity code in range-assign mode',
        'Activity picker',
        'Bulk POST fires. On success: one bar per day across the range in the code color. Range selection clears. Toast / refresh brings them in.',
      ],
      ['Delete N duties', 'Block menu', 'Every activity + assignment inside the range disappears. Canvas refreshes.'],
      ['Esc clears range selection', 'Keyboard', 'Range highlight disappears immediately.'],
      [
        'Drag a pairing bar to another crew row (Move)',
        'Gantt · left-press a bar and drag',
        'Ghost bar appears at cursor showing pairing label. Hovered row tints green (legal), orange (warning = downrank), or red (violation/double-book). Tooltip under ghost shows "Move · P4180 · Legal" etc.',
      ],
      [
        'Release drag on a legal row',
        'Gantt',
        'PATCH fires → pairing reassigns → bar re-appears on the new crew row after refresh. Source bar disappears.',
      ],
      [
        'Release drag on a violation row',
        'Gantt',
        'No API call, no reassignment. Drag state cleared. Row tint clears.',
      ],
      [
        'Ctrl + drag a pairing bar (Copy)',
        'Gantt · hold Ctrl and drag',
        'Ghost prefixed with "+", tooltip says "Copy". Cursor = copy. Release on valid row → POST creates a new assignment; source bar stays intact.',
      ],
      ['Esc during a drag', 'Keyboard', 'Drag cancels. No mutation. Ghost + tint disappear.'],
      ['Right-click during a drag', 'Gantt · while dragging', 'Drag cancels. No context menu shown.'],
      [
        'Release drag outside the canvas',
        'Drag beyond the window',
        'Drag cancels cleanly (window-level mouseup catch). No stuck ghost.',
      ],
      [
        'Start a swap from the pairing menu',
        'Right-click pairing → Swap with… (S)',
        'Top banner appears: "Swap mode · pick another bar to swap with P4180" with a Cancel button (Esc).',
      ],
      [
        'Pick a swap target',
        'Gantt · click another pairing bar while in swap mode',
        'Centered confirm dialog: Side A card (source) ↔ Side B card (target) showing crew names + seat codes. Legend of outcome: "After swap: A → seat B · B → seat A". Cancel + Confirm buttons.',
      ],
      [
        'Confirm swap',
        'Dialog · Confirm swap',
        'POST /crew-schedule/assignments/swap atomically reassigns both. Dialog closes. Both bars update. Rollback on server error surfaces as an inline error banner inside the dialog.',
      ],
      ['Cancel swap (Esc or Cancel)', 'Keyboard or dialog', 'State clears. No mutation.'],
    ],
  },
  {
    title: 'Phase 3 · Command palette, cheatsheet, smart filter',
    color: 'FF6600CC',
    rows: [
      [
        'Press ? (Shift+/)',
        'Keyboard · anywhere outside inputs',
        'Full-screen cheatsheet overlay with 6 sections: Navigation · Selection · Right-click menus · Assign & Edit · Scheduling · Display. Each row shows either a kbd badge or a mouse-hint badge.',
      ],
      ['Close cheatsheet', 'Esc or click backdrop', 'Overlay disappears, focus returns to the canvas.'],
      [
        'Press Ctrl+K (or ⌘K)',
        'Keyboard · anywhere, even inside inputs',
        'Command palette opens centered (Spotlight-style). Input is auto-focused with placeholder "Search actions — swap, bio, zoom, 14d…".',
      ],
      [
        'Type a keyword (e.g. "swap")',
        'Palette · search input',
        'Filtered command list. Counter in top-right updates. Groups collapse to visible sections.',
      ],
      [
        'Use arrow keys + Enter',
        'Palette · ↑/↓ then Enter',
        'Active command highlighted. Enter runs the action and closes the palette.',
      ],
      [
        'Palette shows context-aware commands',
        'Palette · with a pairing selected',
        '"Unassign crew", "Show legality", etc. appear only when an assignment is selected. Without selection those commands are absent.',
      ],
      [
        'Open Smart Filter',
        'Ribbon · Display section · Smart Filter button',
        'Side-sheet docks to the right of the canvas (left of the inspector). "Active" chip only when any criterion is enabled.',
      ],
      [
        'Check "Has rule violation"',
        'Smart Filter · Duty section',
        'In Show-only: only crew with any violated pairing remain. In Highlight: all crew visible but matching rows get accent tint + 3-px accent left strip. In Exclude: matching crew are hidden.',
      ],
      [
        'Switch Mode segmented control',
        'Smart Filter · Mode tiles',
        'Switching between show-only / highlight / exclude reapplies instantly. No Go button.',
      ],
      [
        'Switch Match ANY ↔ ALL',
        'Smart Filter · Match toggle',
        'ANY: OR — row matches if any criterion hits. ALL: AND — must hit every active criterion.',
      ],
      [
        'Pick one or more activity codes',
        'Smart Filter · On activity code chips',
        'Crew on any of the picked codes match (OR within the criterion). Pill turns filled with the code color when selected.',
      ],
      [
        'Reset',
        'Smart Filter · Reset (visible only when active)',
        'All criteria cleared. Mode + combinator unchanged. Canvas restores to full view.',
      ],
    ],
  },
  {
    title: 'Phase 4 · Pairing drawer, block chip, memos, export, publish-diff',
    color: 'FFE63535',
    rows: [
      [
        'Block-hour chip in left panel',
        'Left panel · any crew row',
        'Inline "H:MM" value + 40 px progress bar on the right edge. Accent when under 90% of 100 h limit, orange at ≥90%, red when above 100 h. Hidden at compact zoom and when 0 hrs.',
      ],
      [
        'Legs table',
        'Select a pairing → Right panel · Duty tab · Legs',
        'Table columns: # · Flight (with DH badge if deadhead) · STD · STA · Block. Between consecutive legs, a TAT bar "TAT h:mm at STATION" with "Nightstop" badge if ≥12 h.',
      ],
      [
        'Layovers section',
        'Duty tab (pairing with > 1 duty day)',
        'Accent pill badges per layover airport; hidden when layoverAirports is empty.',
      ],
      ['Complement table', 'Duty tab', '2-column grid of seat codes × count (e.g. CP × 1, FO × 1, CC × 4).'],
      [
        'Add pairing memo',
        'Duty tab · Memos section composer',
        'Type text → Ctrl+Enter (or Add memo). Memo card appears above composer. Canvas bar gains a small yellow dot top-right.',
      ],
      ['Pin a memo', 'Memo card · pin icon', 'Memo moves to top, yellow tint on card.'],
      [
        'Delete a memo',
        'Memo card · trash icon',
        'Memo vanishes. If it was the last pairing memo, the yellow dot on the bar disappears on next refresh.',
      ],
      [
        'Pairing memo via right-click',
        'Right-click pairing bar → View / edit memo',
        'Centered memo overlay with "Pairing memo" header + pairing code. Composer + list identical to inline panel.',
      ],
      [
        'Day memo via right-click',
        'Right-click empty cell → View / edit day memo',
        'Memo overlay header "Day memo · Crew · YYYY-MM-DD". Writes stored with scope=day.',
      ],
      [
        'Crew memo via right-click',
        'Right-click crew name → Crew memo',
        'Memo overlay header "Crew memo · Name". Writes stored with scope=crew.',
      ],
      [
        'Download as PNG',
        'Ctrl+K → Download as PNG',
        'Browser downloads file named crew-schedule_FROM_TO.png capturing the currently-visible canvas viewport.',
      ],
      [
        'Copy as image to clipboard',
        'Ctrl+K → Copy as image to clipboard',
        'Paste into chat / email → schedule image pastes. Falls back silently on browsers without ClipboardItem.',
      ],
      ['Print / Save as PDF', 'Ctrl+K → Print… / Save as PDF', 'Browser print dialog opens. User can save as PDF.'],
      [
        'Publish (Ctrl+Shift+P with no prior publication)',
        'Keyboard',
        'Banner appears: "No publication covers this period yet. Publish to create a baseline." with an orange "Publish now" button. Clicking it creates a snapshot; banner switches to comparison mode.',
      ],
      [
        'Compare to Published (with existing snapshot)',
        'Ctrl+Shift+P · or Ribbon Display → Publish menu (via palette)',
        'Banner: "Comparing to published YYYY-MM-DD HH:MMZ" with a legend (green Added · orange Reassigned · red Removed) and a Re-publish button.',
      ],
      [
        'Added assignment indicator',
        'Create a new assignment while overlay is visible',
        'New bar gets a green dashed outline around it.',
      ],
      [
        'Reassigned assignment indicator',
        'Drag-move an existing pairing to another crew while overlay is visible',
        'Bar on the new crew gets an orange dashed outline.',
      ],
      [
        'Removed (ghost) bar',
        'Delete an assignment while overlay is visible',
        'Ghost bar appears in the original crew row — pale red fill + dashed red border + pairing code in red.',
      ],
      [
        'Close compare overlay',
        'Banner · X button',
        'Diff outlines + ghost bars disappear; Gantt returns to plain rendering.',
      ],
    ],
  },
  {
    title: 'Phase 5 · Leg mode',
    color: 'FF1E40AF',
    rows: [
      [
        'Enter Leg mode',
        'Ribbon · Display section · "Legs" button',
        "Every multi-sector pairing bar splits into individual leg bars positioned at each leg's STD→STA window. The gap between consecutive legs visually encodes TAT.",
      ],
      [
        'Deadhead legs look different',
        'Gantt · leg with DH flag',
        'Fill is muted neutral gray (not accent) with dense 8-px diagonal white stripes overlaid.',
      ],
      [
        'Click a leg',
        'Gantt · any leg bar',
        'Leg gains a white selection ring. Right panel Duty tab shows the parent pairing. selectedPairingId + selectedAssignmentId also set.',
      ],
      [
        'Hover a leg',
        'Gantt · move cursor over a leg',
        'Cursor becomes pointer. No drag highlight appears (drag is pairing-mode only for now).',
      ],
      [
        'Right-click a leg',
        'Gantt · leg bar',
        'Header: "Leg · FLIGHTNUM". Items: Flight FLIGHTNUM (opens details), Open pairing details, Show legality (L), Pairing memo (M). Phase 5+ stubs: Move leg, Copy leg, Mark as deadhead, Break pairing.',
      ],
      [
        'Switch back to Pairings',
        'Ribbon · Display section · "Pairings" button (same location, toggle state)',
        'Legs recombine into a single pairing bar per assignment. Selected leg key clears.',
      ],
      [
        'Leg memo indicator',
        'Gantt · leg with a parent-pairing memo',
        'Yellow dot in top-right, same as pairing-mode memo indicator.',
      ],
    ],
  },
  {
    title: 'Selection · Keyboard shortcuts · Edge cases',
    color: 'FF555770',
    rows: [
      [
        'Delete selected pairing',
        'Click a pairing → press Delete or Backspace',
        'Assignment deleted via API. Bar disappears. Selection clears.',
      ],
      ['Delete selected activity', 'Click an activity → press Delete', 'Activity deleted. Bar disappears.'],
      [
        'Delete does nothing when focus is in an input',
        'Focus any text input, press Delete',
        'Nothing deleted. Standard text-editing Delete/Backspace still works.',
      ],
      [
        'Exclude a crew',
        'Right-click crew → Exclude from view',
        'Crew row disappears from left panel and canvas. Crew count decreases.',
      ],
      ['Restore excluded crew', 'Ctrl+K → "Restore N excluded crew"', 'All excluded crew return. Canvas recomputes.'],
      [
        'Zoom range stepper',
        'Format popover · Range',
        'Steps through 7D → 14D → 28D → M. Bars redistribute; horizontal scroll appears when period > visible window.',
      ],
      [
        'Row height stepper',
        'Format popover · Row Height',
        'All rows + bars grow/shrink. Left panel + canvas stay vertically aligned.',
      ],
      [
        'Refresh interval stepper',
        'Format popover · Refresh Interval',
        'Clamps to 5–59 minutes. (Interval loop is wired by the shell in later phases — default 15.)',
      ],
      [
        'Left filter panel does NOT auto-apply',
        'Left filter panel · toggle any criterion without hitting Go',
        'Canvas does NOT update. Changes stay as drafts. Go commits them and re-fetches.',
      ],
      [
        'Smart Filter DOES auto-apply',
        'Smart Filter side-sheet · toggle any criterion',
        'Canvas updates instantly — no Go.',
      ],
      [
        'Pull scrolling with 5000+ crew',
        'Gantt · fast vertical scroll',
        'Left panel rows scroll smoothly in sync with canvas (shared scrollTop in store, virtualized DOM in left panel).',
      ],
      [
        'Horizontal scroll inside the period',
        'Gantt · horizontal drag or trackpad swipe',
        'Time axis + bars scroll left/right together. Crew rail on the left stays fixed.',
      ],
      ['Hover a pairing bar', 'Gantt · move over a pairing', 'Bar brightens subtly. Cursor = grab.'],
      [
        'Select a crew via left panel click',
        'Left panel · crew row (not right-click)',
        'Row gets accent left strip + highlight. selectedCrewId set. Clicking again deselects.',
      ],
      [
        'Nothing selected state',
        'Click an empty area of the canvas',
        'All selections clear. Right panel shows empty state ("Select a bar, a crew member, or double-click a date to assign an activity.").',
      ],
    ],
  },
]

// ── Build workbook ───────────────────────────────────────────────────

const wb = new ExcelJS.Workbook()
wb.creator = 'SkyHub Crew Schedule'
wb.created = new Date()

const sheet = wb.addWorksheet('Test Cases', {
  views: [{ state: 'frozen', ySplit: 1 }],
})

sheet.columns = [
  { header: 'Action', key: 'action', width: 42 },
  { header: 'Where to click', key: 'where', width: 42 },
  { header: 'Expected Behavior', key: 'expected', width: 80 },
  { header: 'Actual Behavior', key: 'actual', width: 40 },
]

// Header row
const header = sheet.getRow(1)
header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF191921' } }
header.alignment = { vertical: 'middle', horizontal: 'left' }
header.height = 22

function addSectionHeader(title, argbColor) {
  const row = sheet.addRow([title])
  sheet.mergeCells(`A${row.number}:D${row.number}`)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbColor } }
  row.alignment = { vertical: 'middle', horizontal: 'left' }
  row.height = 24
}

function addTestRow([action, where, expected]) {
  const row = sheet.addRow([action, where, expected, ''])
  row.alignment = { vertical: 'top', wrapText: true }
  // Pale border so rows read as a grid
  ;['A', 'B', 'C', 'D'].forEach((col) => {
    row.getCell(col).border = {
      top: { style: 'thin', color: { argb: 'FFE4E4EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE4E4EB' } },
      left: { style: 'thin', color: { argb: 'FFE4E4EB' } },
      right: { style: 'thin', color: { argb: 'FFE4E4EB' } },
    }
  })
  // Faint tint on the "Actual Behavior" column so testers see where to write
  row.getCell('D').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF9E8' },
  }
}

for (const section of sections) {
  addSectionHeader(section.title, section.color)
  for (const r of section.rows) addTestRow(r)
}

// Count rows for footer
const totalTests = sections.reduce((n, s) => n + s.rows.length, 0)
const summary = sheet.addRow([`${totalTests} test cases total · generated ${new Date().toISOString().slice(0, 10)}`])
sheet.mergeCells(`A${summary.number}:D${summary.number}`)
summary.font = { italic: true, color: { argb: 'FF9A9BA8' }, size: 10 }
summary.alignment = { horizontal: 'right' }

const outputPath = path.join(__dirname, '..', 'CREW_SCHEDULE_TEST_PLAN.xlsx')
wb.xlsx.writeFile(outputPath).then(() => {
  console.log(`✓ ${totalTests} test cases written to ${outputPath}`)
})
