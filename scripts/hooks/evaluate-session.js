#!/usr/bin/env node

/**
 * Horizon v2 — Session Evaluation Hook (Stop)
 *
 * Runs at the end of each Claude Code session.
 * Checks if the session was substantial enough to extract learnings.
 * Prints a reminder to save session notes if the session was productive.
 *
 * For full pattern extraction, use /learn command manually.
 * This hook is lightweight — it only reminds, doesn't auto-extract.
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const MIN_SESSION_LENGTH = 10 // Minimum messages to consider "productive"
const LEARNED_DIR = path.join(os.homedir(), '.claude', 'skills', 'learned')

// Ensure learned directory exists
try {
  fs.mkdirSync(LEARNED_DIR, { recursive: true })
} catch {
  /* ignore */
}

// Check session length from environment
const sessionMessages = parseInt(process.env.SESSION_MESSAGE_COUNT || '0', 10)

if (sessionMessages < MIN_SESSION_LENGTH) {
  // Short session — skip
  process.exit(0)
}

// Remind to save learnings
process.stderr.write(`
╭─────────────────────────────────────────────╮
│  Session ended (${sessionMessages} messages)              │
│                                             │
│  Consider:                                  │
│  • Update HORIZON_PROJECT_STATE.md          │
│  • Commit any uncommitted changes           │
│  • Note any learnings worth preserving      │
│                                             │
│  Learned patterns: ~/.claude/skills/learned/ │
╰─────────────────────────────────────────────╯
`)

process.exit(0)
