#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Hook 2: post-edit-guard.sh
# Event:  PostToolUse (Write|Edit|MultiEdit)
# Purpose: Enforce SkyHub v2 architecture + design system rules
#          on every file write. Catches violations that skills
#          and CLAUDE.md can only *suggest* — this *guarantees*.
#
# Guards:
#   1. Component file length (400 lines max for .tsx)
#   2. No hardcoded hex colors in component files
#   3. No inline StyleSheet in render (StyleSheet.create only)
#   4. No font sizes below 11px
#   5. No useState count > 8 per component
#   6. No secrets patterns (API keys, connection strings)
#
# Exit codes:
#   0 = all checks pass
#   1 = warnings (soft violations, logged)
#   2 = BLOCKED (hard violations — file rejected)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '
  .tool_input.file_path //
  .tool_input.path //
  empty
' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
FULL_PATH="$PROJECT_DIR/$FILE_PATH"

# Only guard source files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

# Skip non-existent files (deleted)
if [ ! -f "$FULL_PATH" ]; then
  exit 0
fi

WARNINGS=()
BLOCKS=()

# ─── Guard 1: File length ───────────────────────────────────
LINE_COUNT=$(wc -l < "$FULL_PATH" | tr -d ' ')

if [[ "$FILE_PATH" =~ \.(tsx|jsx)$ ]]; then
  # Component files: hard limit 400
  if [ "$LINE_COUNT" -gt 400 ]; then
    WARNINGS+=("📏 $FILE_PATH is $LINE_COUNT lines (limit: 400). Decompose into smaller components.")
  fi
elif [[ "$FILE_PATH" =~ \.(ts|js)$ ]]; then
  # Logic/utility files: soft limit 600
  if [ "$LINE_COUNT" -gt 600 ]; then
    WARNINGS+=("📏 $FILE_PATH is $LINE_COUNT lines (limit: 600). Consider splitting.")
  fi
fi

# ─── Guard 2: Hardcoded colors in components ────────────────
# Only check component files (tsx/jsx), not theme files
if [[ "$FILE_PATH" =~ \.(tsx|jsx)$ ]] && [[ ! "$FILE_PATH" =~ theme/ ]] && [[ ! "$FILE_PATH" =~ colors\.ts ]]; then
  # Look for hex color literals (#fff, #1a1a1a, etc.) outside comments
  # Allow: palette.*, colors.*, accentColor, transparent, inherit
  HEX_HITS=$(grep -nE "(color|background|border|fill|stroke).*['\"]#[0-9a-fA-F]{3,8}['\"]" "$FULL_PATH" 2>/dev/null | head -5 || true)

  if [ -n "$HEX_HITS" ]; then
    WARNINGS+=("🎨 Hardcoded hex colors found in $FILE_PATH — use palette.* or colors.status.*:")
    WARNINGS+=("$HEX_HITS")
  fi
fi

# ─── Guard 3: Inline styles in render (no StyleSheet) ───────
if [[ "$FILE_PATH" =~ \.(tsx|jsx)$ ]] && [[ "$FILE_PATH" =~ (components|screens|pages)/ ]]; then
  # Detect style={{ ... }} patterns (inline styles in JSX)
  INLINE_HITS=$(grep -ncE 'style=\{\{' "$FULL_PATH" 2>/dev/null || echo "0")

  if [ "$INLINE_HITS" -gt 3 ]; then
    WARNINGS+=("🚫 $FILE_PATH has $INLINE_HITS inline style={{ }} blocks. Use StyleSheet.create() or NativeWind classes.")
  fi
fi

# ─── Guard 4: Font size below 11px ──────────────────────────
if [[ "$FILE_PATH" =~ \.(tsx|jsx|ts)$ ]]; then
  # Match fontSize: N where N < 11
  SMALL_FONT=$(grep -nE 'fontSize:\s*([0-9]|10)(\s|,|})' "$FULL_PATH" 2>/dev/null | head -3 || true)

  if [ -n "$SMALL_FONT" ]; then
    WARNINGS+=("🔤 Font size below 11px detected in $FILE_PATH — minimum is 11px:")
    WARNINGS+=("$SMALL_FONT")
  fi
fi

# ─── Guard 5: Too many useState hooks ───────────────────────
if [[ "$FILE_PATH" =~ \.(tsx|jsx)$ ]]; then
  USE_STATE_COUNT=$(grep -cE 'useState\s*[<(]' "$FULL_PATH" 2>/dev/null || echo "0")

  if [ "$USE_STATE_COUNT" -gt 8 ]; then
    WARNINGS+=("⚡ $FILE_PATH has $USE_STATE_COUNT useState hooks (limit: 8). Move state to Zustand store.")
  fi
fi

# ─── Guard 6: Secret patterns (HARD BLOCK) ──────────────────
# These patterns should NEVER appear in source files
SECRET_PATTERNS=(
  'mongodb\+srv://[^$]'           # MongoDB connection string with credentials
  'sk-[a-zA-Z0-9]{20,}'           # API keys (generic sk- pattern)
  'eyJ[a-zA-Z0-9_-]{20,}\.'       # JWT tokens
  'CHECKWX_API_KEY\s*=\s*["\x27][^$]'  # Hardcoded CheckWX key
  'password\s*[:=]\s*["\x27][^$\{]'     # Hardcoded passwords (not env var refs)
)

for PATTERN in "${SECRET_PATTERNS[@]}"; do
  SECRET_HIT=$(grep -nE "$PATTERN" "$FULL_PATH" 2>/dev/null | head -1 || true)
  if [ -n "$SECRET_HIT" ]; then
    BLOCKS+=("🔐 POTENTIAL SECRET in $FILE_PATH — use Doppler or env vars:")
    BLOCKS+=("   $SECRET_HIT")
  fi
done

# ─── Output results ─────────────────────────────────────────

# Hard blocks first — exit 2 prevents the edit
if [ ${#BLOCKS[@]} -gt 0 ]; then
  echo "🛑 BLOCKED — security violation detected:" >&2
  for msg in "${BLOCKS[@]}"; do
    echo "  $msg" >&2
  done
  exit 2
fi

# Soft warnings — exit 1, Claude sees them and adjusts
if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "⚠️  Design system violations in $FILE_PATH:" >&2
  for msg in "${WARNINGS[@]}"; do
    echo "  $msg" >&2
  done
  echo "" >&2
  echo "  Review SKILL.md and fix before continuing." >&2
  exit 1
fi

# All clear
exit 0
