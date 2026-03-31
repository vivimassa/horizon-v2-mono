---
name: horizon-time-law
description: UTC-only time architecture for Horizon v2. MUST be consulted before writing ANY code that handles timestamps, dates, time arithmetic, or timezone conversion. The coordinate system disaster from v1 cost more time than any other bug category. This skill prevents it from happening again.
---

# Horizon v2 — Time Architecture Law

**This is the single most important architectural rule in the project.** The v1 coordinate system disaster was the most expensive bug category. Every timestamp field, every coordinate calculation, every display function must follow these rules.

## The Law

```
STORE:   UTC only (milliseconds since epoch)
COMPUTE: UTC only (all arithmetic on UTC values)
DISPLAY: Operator-local only (convert at render time)
NEVER:   Mix UTC and local in the same calculation
```

## Field Naming Convention

Every timestamp variable and field MUST declare its timezone context in its name:

| Suffix | Meaning | Example |
|--------|---------|---------|
| `Utc` | UTC milliseconds | `stdUtc`, `ataUtc`, `dutyStartUtc` |
| `Local` | Operator-local display string | `depTimeLocal`, `arrDateLocal` |
| `Ms` | Duration in milliseconds | `restMs`, `dutyMs`, `delayMs` |

**NEVER** use ambiguous names like `departureTime`, `arrivalDate`, `startTime`.

## MongoDB Document Fields

```typescript
// CORRECT — UTC milliseconds, explicit naming
{
  "schedule": {
    "stdUtc": 1743505200000,    // Scheduled Time of Departure — UTC ms
    "staUtc": 1743512400000     // Scheduled Time of Arrival — UTC ms
  },
  "actual": {
    "atdUtc": 1743506000000,    // Actual Time of Departure — UTC ms
    "ataUtc": null               // Not yet arrived
  },
  "operatingDate": "2026-04-01"  // Local operating date — YYYY-MM-DD string
}

// WRONG — ambiguous naming
{
  "departureTime": 1743505200000,  // UTC? Local? Unknown
  "date": "2026-04-01"             // Operating date? UTC date? Unknown
}
```

## WatermelonDB Model Fields

```typescript
@field('std_utc')     stdUtc          // UTC milliseconds — snake_case in DB
@field('sta_utc')     staUtc
@field('atd_utc')     atdUtc          // Nullable
@field('ata_utc')     ataUtc          // Nullable
@field('operating_date') operatingDate // "YYYY-MM-DD" string, local date
```

## The Single Conversion Utility

ALL timezone display conversion goes through ONE function. Never use `new Date().toLocaleString()` or `Intl.DateTimeFormat` directly in components.

```typescript
// src/logic/time.ts — THE ONLY PLACE timezone conversion happens

/**
 * Convert UTC milliseconds to operator-local display string.
 * @param utcMs — UTC milliseconds (e.g., stdUtc from MongoDB)
 * @param tzIana — IANA timezone (e.g., "Asia/Ho_Chi_Minh")
 * @param format — "time" | "date" | "datetime"
 */
export function utcToLocal(utcMs: number, tzIana: string, format: 'time' | 'date' | 'datetime'): string {
  const date = new Date(utcMs)
  switch (format) {
    case 'time':
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: tzIana,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    case 'date':
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: tzIana,
      }).format(date) // Returns YYYY-MM-DD
    case 'datetime':
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: tzIana,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
  }
}

/**
 * Get the LOCAL operating date for a UTC timestamp.
 * Critical for Vietnam UTC+7: a flight at 00:30 local is 17:30 UTC previous day.
 */
export function getOperatingDate(utcMs: number, tzIana: string): string {
  return utcToLocal(utcMs, tzIana, 'date')
}

/**
 * Duration arithmetic — always in UTC milliseconds.
 */
export function durationMs(startUtc: number, endUtc: number): number {
  return endUtc - startUtc
}

export function msToHours(ms: number): number {
  return ms / 3600000
}
```

## Vietnam UTC+7 Traps

Vietnam (Asia/Ho_Chi_Minh) is UTC+7. This creates dangerous date boundaries:

| Local Time | UTC Time | Trap |
|-----------|----------|------|
| 00:00 local | 17:00 UTC previous day | Flight "today" is UTC "yesterday" |
| 06:59 local | 23:59 UTC previous day | Still previous UTC date |
| 07:00 local | 00:00 UTC same day | First moment where local = UTC date |

**Rule:** NEVER derive operating date from UTC date. Always use `getOperatingDate(utcMs, 'Asia/Ho_Chi_Minh')`.

## Gantt Coordinate System (Skia)

For Skia-based Gantt rendering, positions are calculated from UTC:

```typescript
// Convert UTC time to pixel X position on Gantt canvas
function utcToPixelX(utcMs: number, viewStartUtc: number, pixelsPerMs: number): number {
  return (utcMs - viewStartUtc) * pixelsPerMs
}

// Bar width from duration
function barWidth(stdUtc: number, staUtc: number, pixelsPerMs: number): number {
  return (staUtc - stdUtc) * pixelsPerMs
}
```

**NEVER** convert to local time for positioning. Pixel math is always UTC-based. Labels displayed on bars convert to local at render time only.

## Forbidden Patterns

```typescript
// FORBIDDEN — new Date() uses browser/device timezone
const today = new Date().toISOString().split('T')[0]

// FORBIDDEN — mixing local and UTC
const localHour = new Date(utcMs).getHours()  // Uses device timezone!

// FORBIDDEN — ambiguous duration
const restHours = 10  // 10 what? UTC hours? Local hours?

// CORRECT
const restMs = 10 * 3600000  // 10 hours in milliseconds — unambiguous
```

## Test Requirements

Every function that touches timestamps MUST have tests for:
1. Normal case (mid-day flight)
2. UTC midnight boundary (flight crossing 00:00 UTC)
3. Vietnam date boundary (00:00-06:59 local / 17:00-23:59 UTC)
4. Cross-date flight (depart day 1, arrive day 2)
5. Duration calculation with cross-midnight
