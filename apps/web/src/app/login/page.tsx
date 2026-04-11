'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 bg-hz-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-hz-text mb-1">SkyHub</h1>
          <p className="text-sm text-hz-text-secondary">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-hz-border bg-hz-card p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <label className="text-[13px] font-semibold text-hz-text-secondary uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@skyhub.aero"
              autoComplete="email"
              disabled={submitting}
              className="w-full h-11 rounded-lg border border-hz-border bg-hz-bg px-3 text-[14px] text-hz-text outline-none focus:border-hz-accent focus:ring-2 focus:ring-hz-accent/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[13px] font-semibold text-hz-text-secondary uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={submitting}
              className="w-full h-11 rounded-lg border border-hz-border bg-hz-bg px-3 text-[14px] text-hz-text outline-none focus:border-hz-accent focus:ring-2 focus:ring-hz-accent/30"
            />
          </div>

          {error && (
            <div className="rounded-md border-l-4 border-red-600 bg-red-500/10 px-3 py-2">
              <p className="text-[13px] font-medium text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-hz-accent text-white text-[14px] font-semibold disabled:opacity-60 transition-opacity"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
