---
name: refactor-cleaner
description: Dead code cleanup and consolidation for the Horizon v2 Turborepo monorepo. Finds unused exports, duplicate components, orphaned files, and oversized components. Use after major feature completions or before releases.
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
model: sonnet
---

# Refactor & Cleanup — Horizon v2

Dead code detection and safe removal for the Turborepo monorepo (apps/mobile, apps/server, packages/*).

## Detection Commands

```bash
# Unused exports (TypeScript)
npx ts-prune --project apps/mobile/tsconfig.json 2>/dev/null | head -40
npx ts-prune --project apps/server/tsconfig.json 2>/dev/null | head -40

# Unused dependencies
npx depcheck apps/mobile --ignores="@types/*,expo-*"
npx depcheck apps/server

# Oversized files (>1000 lines)
find apps packages -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | sort -rn | head -20

# Files with >10 useState hooks
rg "useState" --include="*.tsx" -c | awk -F: '$2 > 10 { print }'

# Orphaned test files (test file exists but source doesn't)
find . -name "*.test.ts" -o -name "*.test.tsx" | while read f; do
  src=$(echo "$f" | sed 's/__tests__\///' | sed 's/\.test//')
  [ ! -f "$src" ] && echo "ORPHAN: $f"
done

# Duplicate component names across workspaces
find apps packages -name "*.tsx" -exec basename {} \; | sort | uniq -d

# console.log statements
rg "console\.(log|debug)" --include="*.ts" --include="*.tsx" -g "!*.test.*" -g "!node_modules" -c | head -20

# TODO/FIXME without ticket reference
rg "(TODO|FIXME|HACK|XXX)" --include="*.ts" --include="*.tsx" -g "!node_modules" | grep -v "#[0-9]" | head -20
```

## Workflow

### 1. Analyze
Run detection commands. Categorize by risk:
- **SAFE**: Unused exports, unused deps, console.log removal
- **CAREFUL**: Dynamic imports, barrel file exports
- **RISKY**: Shared package exports (may be used by other workspaces)

### 2. Verify
For each item:
- `rg` for all references including dynamic patterns
- Check if exported from a shared package (`packages/`)
- Review git history — recently added code may just need wiring

### 3. Remove Safely
Order: unused deps → unused exports → orphaned files → duplicates → oversized splits
- Run tests after each batch
- Commit after each batch with descriptive message

### 4. Component Splits (>1000 lines)
When a component exceeds 1000 lines:
1. Identify logical sections (data fetching, rendering, event handlers)
2. Extract hooks → `use[Feature].ts`
3. Extract sub-components → `[Feature]Section.tsx`
4. Extract pure logic → `src/logic/[feature].ts`
5. Keep shell component as orchestrator

## Safety Checklist

Before removing:
- [ ] Detection tool confirms unused
- [ ] `rg` confirms no references (including string-based dynamic imports)
- [ ] Not exported from shared package used by other workspaces
- [ ] Tests pass after removal

After each batch:
- [ ] `turbo build` succeeds
- [ ] `npm test` passes
- [ ] Committed with message: `chore: remove unused [category]`

## When NOT to Use

- During active feature development
- Before production deployment
- On code you haven't read HORIZON_PROJECT_STATE.md for context on
- On WatermelonDB models (may be needed for sync even if not directly queried)
