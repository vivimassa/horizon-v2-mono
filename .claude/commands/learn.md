---
name: learn
description: Manually save a learned pattern from the current session. Use when you discover a bug fix, workaround, convention, or useful technique worth remembering for future sessions.
---

# Save a Learned Pattern

Save the pattern described in $ARGUMENTS to a learned skill file.

## Process

1. Parse the description from the user's input
2. Categorize: error_resolution, correction, workaround, domain_convention, performance
3. Create a file at `~/.claude/skills/learned/[category]/[slug].md`
4. Use this format:

```markdown
---
name: [slug]
description: [one-line for auto-invocation matching]
learned_from: [today's date]
confidence: [high/medium/low based on how well-established the pattern is]
---

# [Pattern Name]

## Problem
[What went wrong or was needed]

## Solution
[The fix or correct approach]

## Context
[When this applies — file types, modules, situations]
```

5. Confirm to the user what was saved and where

## Examples

User: `/learn WatermelonDB requires database.write() for all mutations`
→ Save to `~/.claude/skills/learned/workarounds/watermelondb-write-wrapper.md`

User: `/learn Expo Camera crashes in Expo Go, needs dev build`
→ Save to `~/.claude/skills/learned/workarounds/expo-camera-dev-build.md`

User: `/learn VietJet QTA patterns are always 4-sector domestic`
→ Save to `~/.claude/skills/learned/domain_convention/vietjet-qta-4sector.md`
