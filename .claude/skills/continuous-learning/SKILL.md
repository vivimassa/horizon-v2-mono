---
name: continuous-learning
description: Auto-extract reusable patterns from Claude Code sessions and save them to project knowledge. Runs at session end (Stop hook) or manually via /learn command. Captures error resolutions, user corrections, workarounds, and Horizon-specific conventions discovered during development.
---

# Continuous Learning — Horizon v2

Automatically extract reusable patterns from development sessions.

## When to Activate

- End of a productive session (via Stop hook)
- After resolving a tricky bug (capture the fix pattern)
- When user corrects Claude Code's approach (capture the correction)
- After discovering a framework quirk or workaround
- Manually via `/learn` command mid-session

## What to Capture

### High-Value Patterns

| Pattern Type         | Example                                            | Where to Save                         |
| -------------------- | -------------------------------------------------- | ------------------------------------- |
| Error resolution     | "WatermelonDB sync fails when X → fix by Y"        | `.claude/skills/learned/errors/`      |
| User correction      | "Don't use View for Gantt bars, use Skia"          | `.claude/skills/learned/corrections/` |
| Framework workaround | "Expo Camera needs development build, not Expo Go" | `.claude/skills/learned/workarounds/` |
| Convention discovery | "VietJet uses 4-sector QTA patterns"               | `.claude/skills/learned/domain/`      |
| Performance fix      | "FlatList needs getItemLayout for smooth scroll"   | `.claude/skills/learned/performance/` |

### What NOT to Capture

- One-time typo fixes
- External API outages
- Environment-specific issues (local machine config)
- Already documented in existing skill files

## Learned Pattern Format

Save to `~/.claude/skills/learned/[category]/[name].md`:

```markdown
---
name: [descriptive-name]
description: [one-line description for auto-invocation matching]
learned_from: [session date or context]
confidence: [high/medium/low]
---

# [Pattern Name]

## Problem

[What went wrong or what was needed]

## Solution

[What fixed it or how to do it correctly]

## Context

[When this pattern applies]

## Example

[Code example if applicable]
```

## Hook Setup

Add to project `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/evaluate-session.js"
          }
        ]
      }
    ]
  }
}
```

The `evaluate-session.js` script:

1. Checks if session had 10+ messages (skip trivial sessions)
2. Looks for error→fix sequences in the transcript
3. Looks for user corrections ("no, do it this way")
4. Looks for repeated patterns that should become skills
5. Saves extracted patterns to `~/.claude/skills/learned/`

## Manual Extraction

Mid-session, when you discover something worth saving:

```
/learn "WatermelonDB requires database.write() wrapper for all mutations,
       not just create. Forgetting this causes silent failures."
```

This creates a learned pattern file immediately without waiting for session end.

## Review & Curate

Periodically review learned patterns:

```bash
ls ~/.claude/skills/learned/
cat ~/.claude/skills/learned/errors/*.md
```

Promote high-confidence, frequently-relevant patterns into proper skill files. Delete low-value or one-time patterns.

## Integration with HORIZON_PROJECT_STATE.md

Significant learnings (architectural decisions, coordinate system rules, domain conventions) should be promoted from learned patterns into `HORIZON_PROJECT_STATE.md` for permanent project memory.
