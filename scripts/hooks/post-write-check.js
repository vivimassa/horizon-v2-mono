#!/usr/bin/env node

/**
 * Horizon v2 — Post-Write Convention Check Hook
 *
 * Runs after Claude Code writes or edits a .tsx/.ts file.
 * Checks for common Horizon convention violations and warns (does not block).
 *
 * Exit codes:
 *   0 = pass (or non-applicable file)
 *   1 = warnings found (printed to stderr, does not block)
 *   2 = would block (reserved for future critical violations)
 */

const fs = require('fs')
const path = require('path')

// Get the file path from environment (Claude Code sets TOOL_INPUT)
const toolInput = process.env.TOOL_INPUT || ''
let filePath = ''

try {
  const parsed = JSON.parse(toolInput)
  filePath = parsed.file_path || parsed.path || ''
} catch {
  // If not JSON, try direct path
  filePath = toolInput.trim()
}

if (!filePath) process.exit(0)

// Only check .ts and .tsx files in src/
const ext = path.extname(filePath)
if (!['.ts', '.tsx'].includes(ext)) process.exit(0)
if (!filePath.includes('src/') && !filePath.includes('apps/')) process.exit(0)
if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('node_modules')) process.exit(0)

let content
try {
  content = fs.readFileSync(filePath, 'utf8')
} catch {
  process.exit(0) // File might not exist yet during creation
}

const lines = content.split('\n')
const warnings = []

// Check 1: File length > 1000 lines
if (lines.length > 1000) {
  warnings.push(`[WARN] File is ${lines.length} lines (limit: 1000). Consider splitting.`)
} else if (lines.length > 800) {
  warnings.push(`[INFO] File is ${lines.length} lines (approaching 1000 limit).`)
}

// Check 2: Too many useState hooks (only for .tsx)
if (ext === '.tsx') {
  const useStateCount = (content.match(/useState[<(]/g) || []).length
  if (useStateCount > 10) {
    warnings.push(`[WARN] ${useStateCount} useState hooks found (limit: 10). Use Zustand for complex state.`)
  }
}

// Check 3: Hardcoded colors in component files
if (ext === '.tsx' && filePath.includes('components')) {
  const hexMatches = content.match(/(["'])#[0-9a-fA-F]{3,8}\1/g) || []
  // Filter out comments and known exceptions
  const suspicious = hexMatches.filter((m) => {
    const hex = m.slice(1, -1)
    // Allow common non-color hex values
    return !['#000', '#fff', '#000000', '#ffffff'].includes(hex.toLowerCase())
  })
  if (suspicious.length > 0) {
    warnings.push(`[WARN] ${suspicious.length} hardcoded color(s) found. Use palette tokens from useTheme().`)
  }
}

// Check 4: console.log in production code
const consoleLogCount = (content.match(/console\.(log|debug)\(/g) || []).length
if (consoleLogCount > 0) {
  warnings.push(`[INFO] ${consoleLogCount} console.log/debug statement(s). Remove before committing.`)
}

// Check 5: Inline styles in .tsx (style={{ ... }})
if (ext === '.tsx') {
  const inlineStyleCount = (content.match(/style=\{\{/g) || []).length
  if (inlineStyleCount > 3) {
    warnings.push(`[WARN] ${inlineStyleCount} inline styles found. Use StyleSheet.create().`)
  }
}

// Check 6: Font size below 11px
const smallFontMatches = content.match(/fontSize:\s*(8|9|10)\b/g) || []
if (smallFontMatches.length > 0) {
  warnings.push(`[WARN] Font size below 11px found. Minimum is 11px per design system.`)
}

// Check 7: Ambiguous timestamp names
const ambiguousTime = content.match(/\b(departure|arrival|start|end)(Time|Date)\b/g) || []
const properTime = content.match(/\b\w+(Utc|Local|Ms)\b/g) || []
if (ambiguousTime.length > 0 && properTime.length === 0) {
  warnings.push(`[INFO] Ambiguous timestamp names found. Use Utc/Local/Ms suffixes per time-law skill.`)
}

// Output warnings
if (warnings.length > 0) {
  process.stderr.write(`\n[Horizon Convention Check] ${filePath}\n`)
  warnings.forEach((w) => process.stderr.write(`  ${w}\n`))
  process.stderr.write('\n')
}

process.exit(0) // Always exit 0 (warn, don't block)
