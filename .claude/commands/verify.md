---
name: verify
description: Quick verification of Horizon v2 quality gates. Build, types, tests, and convention scan. Use after completing a feature or before committing.
---

# Verify

Run all quality gates in sequence. Invoke the `verification-loop` skill.

```bash
# 1. Build
turbo build 2>&1 | tail -10

# 2. Types
npx tsc --noEmit --pretty 2>&1 | head -20

# 3. Tests
npm test -- --coverage 2>&1 | tail -30

# 4. Convention scan
# Hardcoded colors
rg "#[0-9a-fA-F]{3,8}" --include="*.tsx" apps/mobile/src/components/ -g "!*.test.*" | head -5

# Oversized files
find apps/mobile/src -name "*.tsx" | xargs wc -l 2>/dev/null | awk '$1 > 1000 { print "OVER:", $0 }'

# console.log
rg "console\.(log|debug)" --include="*.ts" --include="*.tsx" apps/ -g "!*.test.*" -g "!node_modules" -c | head -5

# Missing operatorId
rg "\.query\(" --include="*.ts" --include="*.tsx" apps/ | grep -v "operator" | head -5
```

Report results in the verification report format from the `verification-loop` skill.
