#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Hook 3: session-summary.sh
# Event:  Stop
# Purpose: When a Claude Code session ends, generate a markdown
#          summary of what was changed. Saved to .claude/sessions/.
#
#          This creates a paper trail for:
#          - Your own review when resuming work
#          - Comparing professor collaborator patches
#          - Feeding context to the next Claude session
#          - Updating HORIZON_PROJECT_STATE.md
#
# The summary captures:
#   1. Timestamp + session duration indicator
#   2. Git diff --stat (what files changed)
#   3. New files created
#   4. Deleted files
#   5. Total lines added/removed
#
# Exit codes:
#   0 = always (never block a stop)
# ─────────────────────────────────────────────────────────────

set -uo pipefail
# Note: no -e, we don't want any failure to prevent session end

INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
SESSION_DIR="$PROJECT_DIR/.claude/sessions"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE_SLUG=$(date -u +"%Y-%m-%d_%H%M%S")
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

# Check for stop_hook_active to prevent infinite loops
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

# Create sessions directory
mkdir -p "$SESSION_DIR"

# Navigate to project
cd "$PROJECT_DIR"

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  exit 0
fi

# ─── Gather git data ────────────────────────────────────────

# Uncommitted changes (staged + unstaged)
DIFF_STAT=$(git diff --stat HEAD 2>/dev/null || git diff --stat 2>/dev/null || echo "No changes detected")
DIFF_SHORTSTAT=$(git diff --shortstat HEAD 2>/dev/null || git diff --shortstat 2>/dev/null || echo "")

# New untracked files
NEW_FILES=$(git ls-files --others --exclude-standard 2>/dev/null || echo "")

# Recently committed files (last commit, if made this session)
LAST_COMMIT_MSG=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")
LAST_COMMIT_TIME=$(git log -1 --pretty=format:"%ci" 2>/dev/null || echo "")
LAST_COMMIT_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

# Changed file list for quick scanning
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only 2>/dev/null || echo "")

# Count by area
MOBILE_COUNT=$(echo "$CHANGED_FILES" | grep -c "^apps/mobile/" 2>/dev/null || echo "0")
WEB_COUNT=$(echo "$CHANGED_FILES" | grep -c "^apps/web/" 2>/dev/null || echo "0")
UI_COUNT=$(echo "$CHANGED_FILES" | grep -c "^packages/ui/" 2>/dev/null || echo "0")
SERVER_COUNT=$(echo "$CHANGED_FILES" | grep -c "^server/" 2>/dev/null || echo "0")

# ─── Write summary file ─────────────────────────────────────

SUMMARY_FILE="$SESSION_DIR/session-$DATE_SLUG.md"

cat > "$SUMMARY_FILE" << EOF
# Session Summary
**Date:** $TIMESTAMP
**Session ID:** $SESSION_ID

---

## Areas Touched
| Area | Files Changed |
|------|--------------|
| apps/mobile | $MOBILE_COUNT |
| apps/web | $WEB_COUNT |
| packages/ui | $UI_COUNT |
| server | $SERVER_COUNT |

## Diff Stats
\`\`\`
$DIFF_STAT
\`\`\`
$DIFF_SHORTSTAT

## Changed Files
\`\`\`
$CHANGED_FILES
\`\`\`
EOF

# Add new files section if any exist
if [ -n "$NEW_FILES" ]; then
  cat >> "$SUMMARY_FILE" << EOF

## New Files (untracked)
\`\`\`
$NEW_FILES
\`\`\`
EOF
fi

# Add last commit info if relevant
if [ -n "$LAST_COMMIT_MSG" ]; then
  cat >> "$SUMMARY_FILE" << EOF

## Last Commit
- **Message:** $LAST_COMMIT_MSG
- **Time:** $LAST_COMMIT_TIME
- **Files:**
\`\`\`
$LAST_COMMIT_FILES
\`\`\`
EOF
fi

# Add a reminder section
cat >> "$SUMMARY_FILE" << EOF

---

## Next Session Checklist
- [ ] Review changes above before starting new work
- [ ] Run \`npx turbo typecheck\` to verify no type regressions
- [ ] Update HORIZON_PROJECT_STATE.md if module status changed
- [ ] Commit or stash before starting new feature work
EOF

# ─── Prune old sessions (keep last 30) ──────────────────────
# Prevents sessions/ from growing unbounded
ls -1t "$SESSION_DIR"/session-*.md 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true

# Always exit 0 — never prevent session from stopping
exit 0
