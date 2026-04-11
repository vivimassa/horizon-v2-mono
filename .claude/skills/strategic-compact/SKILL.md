---
name: strategic-compact
description: Context management for long Horizon v2 development sessions. Suggests when to compact context based on task phase transitions, not arbitrary token limits. Prevents context rot during multi-phase feature development.
---

# Strategic Compact — Horizon v2

Compact at logical boundaries, not arbitrary token limits.

## When to Compact

| Phase Transition                     | Compact? | Why                                                        |
| ------------------------------------ | -------- | ---------------------------------------------------------- |
| Research → Planning                  | **Yes**  | Research context is bulky; plan is the distilled output    |
| Planning → Implementation            | **Yes**  | Plan is saved to file; free up context for code            |
| Phase A (Data) → Phase B (API)       | **Yes**  | Data layer committed; fresh context for routes             |
| Phase D (UI) → Phase E (Integration) | **Yes**  | Components committed; fresh for sync testing               |
| Debugging → Next feature             | **Yes**  | Debug traces pollute context for unrelated work            |
| After a failed approach              | **Yes**  | Clear dead-end reasoning before new approach               |
| Mid-implementation                   | **No**   | Losing variable names, file paths, partial state is costly |
| Mid-debugging                        | **No**   | Need the error context to continue                         |

## Before Compacting — Save State

Always save important context BEFORE running `/compact`:

1. **Update HORIZON_PROJECT_STATE.md** with decisions made this session
2. **Commit all code changes** (context survives in git, not in memory)
3. **Write a compact summary** for Claude Code:
   ```
   /compact Summary: Completed Phase A (MongoDB schema + WatermelonDB model for crew_duty_log).
   Phase B next: Fastify routes for crew duty CRUD with Zod validation.
   Key decision: embed last-28-day duty summary in crew_members doc, full history in separate collection.
   ```

## What Survives Compaction

| Persists                             | Lost                                |
| ------------------------------------ | ----------------------------------- |
| CLAUDE.md / project instructions     | Intermediate reasoning and analysis |
| Skill files (auto-loaded on trigger) | File contents previously read       |
| Git state (commits, branches)        | Multi-step conversation context     |
| Files on disk                        | Tool call history                   |
| HORIZON_PROJECT_STATE.md             | Nuanced verbal preferences          |

## Context Budget Awareness

Horizon v2 sessions tend to be context-heavy because of:

- Large skill files (frontend, architecture, time-law, db-conventions)
- WatermelonDB model definitions
- Mongoose schema definitions
- File reads during implementation

**Rule of thumb:** If you've done 40+ tool calls (file reads, edits, bash commands) in one session, consider compacting at the next logical boundary.

## Signs of Context Pressure

- Responses become less coherent or miss earlier instructions
- Claude Code "forgets" a convention established earlier in the session
- Repeated file reads for information already discussed
- Slower response times

When you notice these, compact at the next phase boundary.
