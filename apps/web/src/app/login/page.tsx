'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { WallpaperBg } from '@/components/wallpaper-bg'

const LOGIN_CSS = `
@keyframes login-card{0%{opacity:0;transform:translateY(24px) scale(.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes login-fade{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
`

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 10,
  padding: '0 14px',
  fontSize: 14,
  color: 'rgba(255,255,255,0.9)',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  outline: 'none',
  transition: 'all 200ms ease',
}

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(62,123,250,0.6)'
    e.target.style.boxShadow = '0 0 0 3px rgba(62,123,250,0.15), 0 0 20px rgba(62,123,250,0.08)'
    e.target.style.background = 'rgba(255,255,255,0.10)'
  }, [])
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.12)'
    e.target.style.boxShadow = 'none'
    e.target.style.background = 'rgba(255,255,255,0.07)'
  }, [])

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
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#0a0a12' }}>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_CSS }} />
      <WallpaperBg showIndicators />

      {/* ── Content ── */}
      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* Left branding (desktop) */}
        <div
          className="hidden lg:flex flex-1 flex-col justify-between p-16"
          style={{ animation: 'login-fade 1s ease-out 0.2s both' }}
        >
          <div />
          <div className="max-w-md">
            <img
              src="/skyhub-logo.png"
              alt="SkyHub"
              className="mb-6"
              style={{
                height: 120,
                filter: 'brightness(0) invert(1) drop-shadow(0 2px 20px rgba(0,0,0,0.5))',
              }}
            />
            <div className="h-px w-16 bg-white/20" />
            <p className="mt-6 text-[14px] text-white/45 leading-relaxed max-w-sm">
              Network planning, movement control, crew operations, and ground handling — unified in one intelligent
              system.
            </p>
          </div>
        </div>

        {/* Right: Login card */}
        <div className="flex flex-1 items-center justify-center p-6 lg:p-16">
          <div className="w-full max-w-[400px]" style={{ animation: 'login-card 0.8s ease-out 0.4s both' }}>
            {/* Mobile branding */}
            <div className="lg:hidden flex justify-center mb-10">
              <img src="/skyhub-logo.png" alt="SkyHub" style={{ height: 56, filter: 'brightness(0) invert(1)' }} />
            </div>

            {/* Glass card */}
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl p-8 space-y-5"
              style={{
                background: 'rgba(12,12,20,0.45)',
                backdropFilter: 'blur(40px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-center mb-2">
                <h2 className="text-xl font-semibold text-white">Sign in</h2>
                <p className="text-[13px] text-white/40 mt-1">Enter your credentials to continue</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@airline.aero"
                  autoComplete="email"
                  disabled={submitting}
                  style={{ ...inputStyle, opacity: submitting ? 0.5 : 1 }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="--------"
                  autoComplete="current-password"
                  disabled={submitting}
                  style={{ ...inputStyle, opacity: submitting ? 0.5 : 1 }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <div className="flex justify-end mt-1.5">
                  <Link
                    href="/login/forgot-password"
                    className="text-[13px] font-medium no-underline transition-colors"
                    style={{ color: 'rgba(91,141,239,0.8)' }}
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error && (
                <div
                  className="rounded-lg px-3 py-2.5"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}
                >
                  <p className="text-[13px] font-medium text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="relative w-full overflow-hidden transition-all duration-300"
                style={{
                  height: 44,
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white',
                  background: 'linear-gradient(135deg, #1e40af 0%, #3b6cf5 100%)',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.65 : 1,
                  boxShadow: '0 4px 16px rgba(30,64,175,0.35)',
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(30,64,175,0.5), 0 0 40px rgba(62,123,250,0.15)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(30,64,175,0.35)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
