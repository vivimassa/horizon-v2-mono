---
name: verification-loop
description: Comprehensive verification system for Horizon v2. Run after completing a feature, before creating a PR, or after refactoring. Checks build, types, lint, tests, security, and Horizon-specific conventions.
---

# Verification Loop — Horizon v2

Run all quality gates in sequence. Stop and fix at any failure before continuing.

## When to Use

- After completing a feature or significant code change
- Before creating a PR
- After refactoring
- After resolving build errors (confirm nothing else broke)

## Verification Phases

### Phase 1: Build
```bash
# Monorepo build
turbo build 2>&1 | tail -20

# If build fails, STOP. Use build-error-resolver agent.
```

### Phase 2: TypeScript
```bash
# All workspaces
npx tsc --noEmit --pretty 2>&1 | head -30

# Server workspace specifically
cd apps/server && npx tsc --noEmit --pretty 2>&1 | head -30
```

### Phase 3: Lint
```bash
npx eslint apps/mobile/src --ext .ts,.tsx 2>&1 | head -30
npx eslint apps/server/src --ext .ts 2>&1 | head -30
```

### Phase 4: Tests
```bash
npm test -- --coverage 2>&1 | tail -50
# Target: 80% minimum coverage
```

### Phase 5: Horizon Convention Scan
```bash
# Hardcoded colors (should use palette tokens)
rg "#[0-9a-fA-F]{3,8}" --include="*.tsx" apps/mobile/src/components/ -g "!*.test.*" | grep -v "// theme" | head -10

# Missing operatorId in queries
rg "\.query\(" --include="*.ts" --include="*.tsx" apps/mobile/src/ | grep -v "operator_id\|operatorId" | head -10

# Oversized components
find apps/mobile/src -name "*.tsx" | xargs wc -l 2>/dev/null | awk '$1 > 1000 { print "OVER LIMIT:", $0 }' | sort -rn

# useState count per file
rg "useState" --include="*.tsx" apps/mobile/src/ -c | awk -F: '$2 > 10 { print "TOO MANY useState:", $0 }'

# console.log in production code
rg "console\.(log|debug)" --include="*.ts" --include="*.tsx" apps/ -g "!*.test.*" -g "!node_modules" -c | head -10

# Inline styles (should use StyleSheet.create)
rg "style=\{\{" --include="*.tsx" apps/mobile/src/components/ -c | awk -F: '$2 > 3 { print "INLINE STYLES:", $0 }'

# Font sizes below 11px
rg "fontSize:\s*(8|9|10)[^0-9]" --include="*.ts" --include="*.tsx" apps/mobile/src/ | head -10

# Ambiguous timestamp names (missing Utc/Local/Ms suffix)
rg "(departure|arrival|start|end)Time[^ULM]" --include="*.ts" --include="*.tsx" apps/ -g "!*.test.*" | head -10
```

### Phase 6: Security Quick Scan
```bash
# Secrets in code
rg "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"]" --include="*.ts" --include="*.tsx" -g "!*.test.*" -g "!*.example*" | head -10

# PII in logs
rg "console\.(log|info|warn|error).*\b(passport|medical|ssn|address|phone)\b" --include="*.ts" --include="*.tsx" | head -10

# Dependencies audit
npm audit --audit-level=high 2>&1 | tail -10
```

### Phase 7: Diff Review
```bash
git diff --stat
git diff HEAD~1 --name-only
```

## Output Format

```
VERIFICATION REPORT — Horizon v2
=================================

Build:        [PASS/FAIL]
TypeScript:   [PASS/FAIL] (X errors)
Lint:         [PASS/FAIL] (X warnings)
Tests:        [PASS/FAIL] (X/Y passed, Z% coverage)
Conventions:  [PASS/FAIL] (X issues)
Security:     [PASS/FAIL] (X issues)
Diff:         [X files changed, +Y/-Z lines]

Overall:      [READY / NOT READY] for PR

Issues to Fix:
1. ...
2. ...
```

## Integration with Agents

If verification fails:
- **Build errors** → invoke `build-error-resolver` agent
- **Type errors** → invoke `build-error-resolver` agent
- **Test failures** → invoke `tdd-guide` agent
- **Security issues** → invoke `security-reviewer` agent
- **Convention violations** → fix manually (usually quick)
- **Oversized components** → invoke `refactor-cleaner` agent
