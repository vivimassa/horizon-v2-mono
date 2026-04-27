#!/usr/bin/env node
/**
 * Frees TCP port 8082 (auto-roster solver) before launching uvicorn.
 *
 * Why: on Windows, `uvicorn --reload` accumulates orphan listen sockets
 * across turbo/concurrently restarts. The kernel keeps the socket bound
 * to the dead PID until the parent that inherited the handle exits, so
 * a fresh uvicorn either fails to bind or — worse — coexists with stale
 * listeners that hand out half-dead connections (manifests as the
 * orchestrator seeing undici "terminated" mid-stream).
 *
 * Cross-platform: uses `lsof` on macOS/Linux and `netstat`+`taskkill`
 * on Windows. No external deps.
 */
import { execSync } from 'node:child_process'

const PORT = 8082

function killWindows() {
  let lines = ''
  try {
    lines = execSync(`netstat -ano -p TCP`, { encoding: 'utf8' })
  } catch {
    return []
  }
  const pids = new Set()
  for (const line of lines.split(/\r?\n/)) {
    // "  TCP    0.0.0.0:8082    0.0.0.0:0    LISTENING    12345"
    const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/)
    if (m && Number(m[1]) === PORT) pids.add(m[2])
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
    } catch {
      // already gone
    }
  }
  return [...pids]
}

function killUnix() {
  let out = ''
  try {
    out = execSync(`lsof -nP -iTCP:${PORT} -sTCP:LISTEN -t`, { encoding: 'utf8' })
  } catch {
    return []
  }
  const pids = out.split(/\s+/).filter(Boolean)
  for (const pid of pids) {
    try {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
    } catch {}
  }
  return pids
}

const killed = process.platform === 'win32' ? killWindows() : killUnix()
if (killed.length > 0) {
  console.log(`[free-solver-port] killed ${killed.length} stale listener(s) on :${PORT} → PIDs ${killed.join(', ')}`)
} else {
  console.log(`[free-solver-port] :${PORT} clean`)
}
