#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Hook 1: post-edit-typecheck.sh
# Event:  PostToolUse (Write|Edit|MultiEdit)
# Purpose: Run TypeScript type-check on changed .ts/.tsx files
#          after every Claude Code edit. Catches type errors
#          before they compound across multi-file changes.
#
# Exit codes:
#   0 = pass (or non-TS file, skip silently)
#   1 = warning only (type errors found, logged to stderr)
#       We use exit 1 (warn) not exit 2 (block) because
#       blocking mid-edit can break multi-step refactors.
#       Claude sees the warning and self-corrects.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# Read stdin JSON from Claude Code
INPUT=$(cat)

# Extract the file path from the tool input
# Claude Code passes different shapes depending on the tool:
#   Write: { tool_input: { file_path: "..." } }
#   Edit/MultiEdit: { tool_input: { file_path: "..." } }
FILE_PATH=$(echo "$INPUT" | jq -r '
  .tool_input.file_path //
  .tool_input.path //
  empty
' 2>/dev/null || echo "")

# If we couldn't extract a path, skip silently
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only check TypeScript files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

# Determine which tsconfig to use based on monorepo location
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
TSCONFIG=""

if [[ "$FILE_PATH" == apps/mobile/* ]]; then
  TSCONFIG="apps/mobile/tsconfig.json"
elif [[ "$FILE_PATH" == apps/web/* ]]; then
  TSCONFIG="apps/web/tsconfig.json"
elif [[ "$FILE_PATH" == packages/ui/* ]]; then
  TSCONFIG="packages/ui/tsconfig.json"
elif [[ "$FILE_PATH" == server/* ]]; then
  TSCONFIG="server/tsconfig.json"
fi

# If no matching tsconfig found, try root
if [ -z "$TSCONFIG" ] || [ ! -f "$PROJECT_DIR/$TSCONFIG" ]; then
  if [ -f "$PROJECT_DIR/tsconfig.json" ]; then
    TSCONFIG="tsconfig.json"
  else
    # No tsconfig at all, skip
    exit 0
  fi
fi

# Run tsc --noEmit on just this file's project
# --skipLibCheck speeds up the check significantly
cd "$PROJECT_DIR"
TSC_OUTPUT=$(npx tsc --noEmit --skipLibCheck --project "$TSCONFIG" 2>&1) || {
  # Type errors found — report as warning
  # Filter output to only show errors in the changed file
  RELEVANT=$(echo "$TSC_OUTPUT" | grep -F "$FILE_PATH" || true)

  if [ -n "$RELEVANT" ]; then
    echo "⚠️  TypeScript errors in $FILE_PATH:" >&2
    echo "$RELEVANT" >&2
    echo "" >&2
    echo "Fix these before moving on." >&2
    exit 1
  fi

  # Errors exist but not in our file — pre-existing, skip
  exit 0
}

# Clean pass
exit 0
