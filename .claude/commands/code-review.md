---
name: code-review
description: Run a comprehensive Horizon v2 code review on recent changes. Checks airline domain rules, design system, offline patterns, security, and general quality.
---

# Code Review

Run a comprehensive review of recent code changes.

## Process

1. **Gather changes**: Run `git diff --staged` and `git diff` to see all modifications
2. **Delegate to code-reviewer agent**: Pass the diff context to the `code-reviewer` agent
3. **Report findings**: Organized by severity (CRITICAL → HIGH → MEDIUM → LOW)
4. **Verdict**: APPROVE / WARNING / BLOCK

## Quick Checks (run these first)

```bash
# What changed
git diff --stat
git diff --name-only

# Build still works
turbo build 2>&1 | tail -5

# Types still pass
npx tsc --noEmit 2>&1 | head -10

# Tests still pass
npm test 2>&1 | tail -10
```

## Then delegate to code-reviewer agent for deep review

Focus areas:
- operatorId on every query
- UTC-only timestamps
- Design system compliance (palette tokens, typography, corner radius)
- Component size (<1000 lines)
- Offline-first patterns
- Security (PII protection, auth, tenant isolation)
- React Native best practices (FlatList optimization, memo, StyleSheet)
