#!/usr/bin/env node

/**
 * Horizon v2 — Pre-Commit Quality Gate
 *
 * Install: Copy to .git/hooks/pre-commit (or use husky)
 *
 * Checks staged files for:
 * 1. Hardcoded secrets (API keys, tokens)
 * 2. console.log statements
 * 3. Files over 1000 lines
 * 4. Font sizes below 11px
 * 5. Conventional commit message format (in commit-msg hook)
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const errors = []
const warnings = []

// Get staged files
let stagedFiles
try {
  stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => f && (f.endsWith('.ts') || f.endsWith('.tsx')))
    .filter((f) => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('node_modules'))
} catch {
  process.exit(0)
}

if (stagedFiles.length === 0) process.exit(0)

for (const file of stagedFiles) {
  let content
  try {
    content = fs.readFileSync(file, 'utf8')
  } catch {
    continue
  }

  const lines = content.split('\n')

  // Secret patterns
  const secretPatterns = [
    /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    /sk-[a-zA-Z0-9]{20,}/g,
    /mongodb\+srv:\/\/[^"'\s]+/g,
  ]

  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      errors.push(`[CRITICAL] Possible secret in ${file} — check for hardcoded credentials`)
      break
    }
  }

  // File length
  if (lines.length > 1000) {
    errors.push(`[HIGH] ${file} is ${lines.length} lines (limit: 1000)`)
  }

  // console.log (excluding test files, already filtered above)
  const consoleLogs = (content.match(/console\.(log|debug)\(/g) || []).length
  if (consoleLogs > 0) {
    warnings.push(`[WARN] ${file} has ${consoleLogs} console.log/debug statement(s)`)
  }

  // Font size below 11px
  if (file.endsWith('.tsx') && /fontSize:\s*(8|9|10)\b/.test(content)) {
    errors.push(`[HIGH] ${file} has font size below 11px minimum`)
  }
}

// Report
if (warnings.length > 0) {
  console.error('\nHorizon Pre-Commit Warnings:')
  warnings.forEach((w) => console.error(`  ${w}`))
}

if (errors.length > 0) {
  console.error('\nHorizon Pre-Commit Errors (blocking commit):')
  errors.forEach((e) => console.error(`  ${e}`))
  console.error('\nFix these issues before committing.\n')
  process.exit(1)
}

if (warnings.length > 0) {
  console.error('') // Blank line after warnings
}

process.exit(0)
