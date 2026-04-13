'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { api } from '@skyhub/api'
import { WallpaperBg } from '@/components/wallpaper-bg'

const PAGE_CSS = `
@keyframes fp-card{0%{opacity:0;transform:translateY(24px) scale(.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

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
    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await api.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#0a0a12' }}>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <WallpaperBg />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-[400px]" style={{ animation: 'fp-card 0.8s ease-out 0.3s both' }}>
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <img src="/skyhub-logo.png" alt="SkyHub" style={{ height: 56, filter: 'brightness(0) invert(1)' }} />
          </div>

          {/* Glass card */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'rgba(12,12,20,0.45)',
              backdropFilter: 'blur(40px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {sent ? (
              /* ── Success state ── */
              <div className="text-center space-y-4">
                <div
                  className="mx-auto flex items-center justify-center rounded-full"
                  style={{ width: 48, height: 48, background: 'rgba(34,197,94,0.15)' }}
                >
                  <CheckCircle size={24} style={{ color: '#22c55e' }} />
                </div>
                <h2 className="text-xl font-semibold text-white">Check your email</h2>
                <p className="text-[14px] text-white/50 leading-relaxed">
                  If an account exists for <span className="text-white/80 font-medium">{email}</span>, we&apos;ve sent a
                  password reset link. It expires in 1 hour.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-[14px] font-medium mt-4 no-underline transition-colors"
                  style={{ color: 'rgba(91,141,239,0.9)' }}
                >
                  <ArrowLeft size={16} />
                  Back to sign in
                </Link>
              </div>
            ) : (
              /* ── Form state ── */
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="text-center mb-2">
                  <div
                    className="mx-auto flex items-center justify-center rounded-full mb-4"
                    style={{ width: 48, height: 48, background: 'rgba(62,123,250,0.12)' }}
                  >
                    <Mail size={22} style={{ color: '#5B8DEF' }} />
                  </div>
                  <h2 className="text-xl font-semibold text-white">Forgot password?</h2>
                  <p className="text-[13px] text-white/40 mt-1">
                    Enter your email and we&apos;ll send you a reset link
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@airline.aero"
                    autoComplete="email"
                    autoFocus
                    disabled={submitting}
                    style={{ ...inputStyle, opacity: submitting ? 0.5 : 1 }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>

                {error && (
                  <div
                    className="rounded-lg px-3 py-2.5"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
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
                >
                  {submitting ? 'Sending...' : 'Send reset link'}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium no-underline transition-colors"
                    style={{ color: 'rgba(255,255,255,0.40)' }}
                  >
                    <ArrowLeft size={14} />
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
