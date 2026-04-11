#!/usr/bin/env node

/**
 * Horizon v2 — Commit Message Format Validator
 *
 * Install: Copy to .git/hooks/commit-msg (or use husky)
 *
 * Enforces conventional commit format:
 *   <type>: <description>
 *
 * Types: feat, fix, refactor, docs, test, chore, perf, ci, style, build
 */

const fs = require('fs')

const msgFile = process.argv[2]
if (!msgFile) process.exit(0)

let msg
try {
  msg = fs.readFileSync(msgFile, 'utf8').trim()
} catch {
  process.exit(0)
}

// Skip merge commits
if (msg.startsWith('Merge ')) process.exit(0)

// Conventional commit pattern
const validTypes = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci', 'style', 'build']
const pattern = new RegExp(`^(${validTypes.join('|')})(\\(.+\\))?:\\s.+`)

if (!pattern.test(msg)) {
  console.error(`
╭──────────────────────────────────────────────────────╮
│  Invalid commit message format                       │
│                                                      │
│  Expected: <type>: <description>                     │
│  Example:  feat: add crew duty CRUD routes           │
│  Example:  fix: correct UTC boundary in Gantt render │
│                                                      │
│  Valid types:                                        │
│  feat, fix, refactor, docs, test, chore,             │
│  perf, ci, style, build                              │
│                                                      │
│  Your message: "${msg.substring(0, 50)}${msg.length > 50 ? '...' : ''}"
╰──────────────────────────────────────────────────────╯
`)
  process.exit(1)
}

process.exit(0)
