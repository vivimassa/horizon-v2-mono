# Scheduling — Task Scheduler Design Rules

These rules govern every cron / scheduled-task UI in Horizon. Read before touching 7.1.6 Task Scheduler Management or shipping a new built-in task.

## Forms — always reuse, never roll your own

The drawer body is composed from two canonical forms in this folder:

- **`<SchedulePolicyForm value onChange maxTimes minuteStep>`** — frequency, day-of-week, day-of-month, times-of-day, timezone. Editing the underlying `SchedulePolicyRef`.
- **`<NotificationsPolicyForm value onChange>`** — onMissedStart / onTerminated / onError + recipient list. Editing `ScheduledTaskNotifications`.

Both compose only SkyHub primitives. **Do not duplicate this UI inside a task's config dialog.** Add fields by extending these forms, not by forking them.

## Primitives — banned natives

| Need                      | Use                                                           | NEVER use                                     |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| Hour:minute picker        | `<TimeOfDayPicker>` from `@/components/ui/time-of-day-picker` | `<input type="time">`                         |
| Timezone                  | `<TimezoneDropdown>` from `@/components/ui/timezone-dropdown` | `<input type="text">`, hard-coded preset list |
| Frequency / single-choice | `<Dropdown>` from `@/components/ui/dropdown`                  | `<select>`                                    |
| Text / number             | `<TextInput>` from `@/components/ui`                          | bare `<input>`                                |
| On/off toggle             | `<ToggleSwitch>` from `@/components/ui`                       | checkbox                                      |

Native `<input type="time">` renders inconsistently across browsers and ignores design tokens. Banned site-wide for scheduler UIs.

## Dialog layout (TaskConfigDrawer pattern)

- **Centered modal**, not a side drawer. Reuse `task-config-drawer.tsx` shape.
- **Width: 1120px**, max-w-full
- **Height: 640px**, max-h-88vh
- **Header: exactly 104px** with the hero pattern (gradient + radial glow + grid backdrop, eyebrow `Task #N · Scheduler` 11px accent 0.14em tracking → 18px bold title → 12px description, SVG illustration on right at `top-1/2 -translate-y-1/2 right-14`).
- **Tabs:** Description / Schedule / Notifications, underline-accent style.
- **Footer:** Cancel (left, ghost) + Save (right, accent, disabled until dirty).

If you need an extra tab, add it next to those three — don't replace them.

## Hero illustrations

- **220×80 viewBox**, sized for the 104px header.
- One SVG per built-in `taskKey`. Add new entries to `task-hero-illustrations.tsx` and the `HeroForTask` switch.
- Use `accent` and `dim` colour args; never hard-code hex.
- Follow the same vocabulary as 4.1.6.3 Scheduling Configurations heroes — bars, dials, simple iconography.
- `GenericTaskHero` is the fallback when a `taskKey` has no entry.

## Server side — runner registration

- Register a new task by adding to `server/src/jobs/task-registry.ts`:
  ```ts
  registry.set('your-task-key', async (ctx) => { ... return stats })
  ```
  The dispatcher (`task-scheduler.ts`) does the rest — DO NOT write a custom interval/cron loop.
- Worker file lives under `server/src/jobs/tasks/<your-task-key>.ts`.
- Worker signature: `(operatorId, params, log) => Promise<stats>`. Use the `log` callback for progress; the registry persists it to `ScheduledTaskRun.lastProgress*` and `logs` (ring-buffered at 500).
- Idempotent upsert keyed by `(operatorId, ..., snapshotIso/dateIso)` so manual reruns of the same date overwrite cleanly.
- Operator timezone via `Operator.timezone`, never hard-code.

## Seeding new built-in tasks

- Append to `BUILTIN_TASKS` in `server/src/seed-scheduled-tasks.ts`. Default `active: false` and `auto: false` — admins opt in.
- Bump `displayNumber` in increasing order. AIMS-style numbering (1, 2, 3, …) — keep dense.
- Default schedule should be sane operationally. Don't ship 03:00 if the task contends with the auto-roster window.

## Module registry

- Add `code: '7.1.6.N'` rows under `parent_code: '7.1.6'` only when the task has its own dedicated screen. The Task Scheduler list view at `7.1.6` exposes all tasks already.

## Backfill

- Long-history tasks ship a one-shot backfill script at `server/src/backfill-<task-key>.ts` that loops the worker over relevant dates. Reuse the worker — never duplicate compute.

## Don't

- Don't add a "Permissions" or "Clone" button until at least 3 built-in tasks exist. Stub it.
- Don't allow users to create arbitrary tasks — only built-ins seeded from the registry.
- Don't bypass the dispatcher with `setInterval` from inside a route handler.
- Don't store schedule cron strings — the canonical shape is `SchedulePolicyRef` with frequency + times. Cron strings invite `* * * * *` wars.
