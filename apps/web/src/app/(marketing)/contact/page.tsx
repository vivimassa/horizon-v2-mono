'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, MapPin, Clock, CheckCircle2, AlertCircle, Send } from 'lucide-react'
import { HeroAurora } from '@/components/marketing/hero-aurora'
import { submitContact, type ContactSubmissionInput } from '@/lib/contact-client'

const COUNTRIES = [
  'Vietnam',
  'Thailand',
  'Singapore',
  'Malaysia',
  'Indonesia',
  'Philippines',
  'Cambodia',
  'Laos',
  'Myanmar',
  'Japan',
  'South Korea',
  'Australia',
  'India',
  'United Arab Emirates',
  'Other',
]

const SOURCES = ['Search engine', 'Industry event', 'Referral', 'LinkedIn', 'Press / article', 'Other']

const EMPTY: ContactSubmissionInput = {
  name: '',
  company: '',
  airline: '',
  role: '',
  email: '',
  phone: '',
  country: '',
  message: '',
  source: '',
  consent: false,
}

export default function ContactPage() {
  const [form, setForm] = useState<ContactSubmissionInput>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<null | { ok: true } | { ok: false; error: string }>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function update<K extends keyof ContactSubmissionInput>(key: K, value: ContactSubmissionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Required'
    if (!form.company.trim()) errs.company = 'Required'
    if (!form.email.trim()) errs.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email'
    if (!form.message.trim() || form.message.trim().length < 10) errs.message = 'Please tell us a bit more (10+ chars)'
    if (!form.consent) errs.consent = 'Please accept before submitting'
    return errs
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setSubmitting(true)
    const res = await submitContact(form)
    setSubmitting(false)
    if (res.ok) {
      setStatus({ ok: true })
      setForm(EMPTY)
    } else {
      setStatus({ ok: false, error: res.error })
      if (res.fieldErrors) setFieldErrors(res.fieldErrors)
    }
  }

  return (
    <>
      <HeroAurora>
        <div className="text-center max-w-3xl mx-auto">
          <div
            className="text-[13px] uppercase tracking-[0.22em] font-bold mb-5"
            style={{ color: 'var(--mkt-accent)' }}
          >
            Contact
          </div>
          <h1
            className="text-[40px] md:text-[64px] leading-[1.05] font-bold tracking-tight"
            style={{ color: 'var(--mkt-text)', letterSpacing: '-0.02em' }}
          >
            Tell us about <span className="mkt-gradient-text">your operation.</span>
          </h1>
          <p className="mt-6 text-[17px] md:text-[19px] leading-[1.55]" style={{ color: 'var(--mkt-text-dim)' }}>
            Drop us a note and our team will come back to you within one business day.
          </p>
        </div>
      </HeroAurora>

      <section className="pb-24">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-14">
            {/* Left column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6 }}
              className="md:col-span-2"
            >
              <div
                className="text-[13px] uppercase tracking-[0.22em] font-bold mb-3"
                style={{ color: 'var(--mkt-accent)' }}
              >
                Talk to us
              </div>
              <h2
                className="text-[28px] md:text-[34px] font-bold tracking-tight leading-[1.15] mb-5"
                style={{ color: 'var(--mkt-text)', letterSpacing: '-0.02em' }}
              >
                We'd rather have a real conversation.
              </h2>
              <p className="text-[15px] leading-[1.65] mb-8" style={{ color: 'var(--mkt-text-dim)' }}>
                Whatever you're running today — legacy systems, in-house builds, or spreadsheets — we'll meet you where
                you are and walk you through the shortest path to SkyHub.
              </p>

              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(62,123,250,0.14)', color: 'var(--mkt-accent)' }}
                  >
                    <Mail size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <div
                      className="text-[13px] uppercase tracking-[0.12em] font-semibold mb-1"
                      style={{ color: 'var(--mkt-text-dim)' }}
                    >
                      Email
                    </div>
                    <a
                      href="mailto:hello@skyhub.app"
                      className="text-[15px] font-medium"
                      style={{ color: 'var(--mkt-text)' }}
                    >
                      hello@skyhub.app
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(62,123,250,0.14)', color: 'var(--mkt-accent)' }}
                  >
                    <MapPin size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <div
                      className="text-[13px] uppercase tracking-[0.12em] font-semibold mb-1"
                      style={{ color: 'var(--mkt-text-dim)' }}
                    >
                      Headquarters
                    </div>
                    <div className="text-[15px] font-medium" style={{ color: 'var(--mkt-text)' }}>
                      Ho Chi Minh City, Vietnam
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(62,123,250,0.14)', color: 'var(--mkt-accent)' }}
                  >
                    <Clock size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <div
                      className="text-[13px] uppercase tracking-[0.12em] font-semibold mb-1"
                      style={{ color: 'var(--mkt-text-dim)' }}
                    >
                      Response time
                    </div>
                    <div className="text-[15px] font-medium" style={{ color: 'var(--mkt-text)' }}>
                      Within one business day
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
              onSubmit={onSubmit}
              className="md:col-span-3 mkt-glass p-7 md:p-10"
            >
              {status?.ok === true && (
                <div
                  className="mb-6 flex items-start gap-3 p-4 rounded-xl"
                  style={{
                    background: 'rgba(6,194,112,0.10)',
                    border: '1px solid rgba(6,194,112,0.30)',
                    color: 'var(--mkt-text)',
                  }}
                >
                  <CheckCircle2 size={18} strokeWidth={2.2} style={{ color: '#06C270' }} />
                  <div>
                    <div className="text-[14px] font-semibold">Thanks — we've received your message.</div>
                    <div className="text-[13px] mt-0.5" style={{ color: 'var(--mkt-text-dim)' }}>
                      A sales engineer will be in touch within one business day.
                    </div>
                  </div>
                </div>
              )}
              {status && status.ok === false && (
                <div
                  className="mb-6 flex items-start gap-3 p-4 rounded-xl"
                  style={{
                    background: 'rgba(255,59,59,0.08)',
                    border: '1px solid rgba(255,59,59,0.28)',
                    color: 'var(--mkt-text)',
                  }}
                >
                  <AlertCircle size={18} strokeWidth={2.2} style={{ color: '#FF3B3B' }} />
                  <div>
                    <div className="text-[14px] font-semibold">Couldn't submit your message.</div>
                    <div className="text-[13px] mt-0.5" style={{ color: 'var(--mkt-text-dim)' }}>
                      {status.error}. Please try again or email us directly.
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Name" required error={fieldErrors.name}>
                  <input
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    className="mkt-input"
                  />
                </Field>
                <Field label="Email" required error={fieldErrors.email}>
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    className="mkt-input"
                  />
                </Field>
                <Field label="Company" required error={fieldErrors.company}>
                  <input
                    type="text"
                    autoComplete="organization"
                    value={form.company}
                    onChange={(e) => update('company', e.target.value)}
                    className="mkt-input"
                  />
                </Field>
                <Field label="Airline / Operator (if different)">
                  <input
                    type="text"
                    value={form.airline}
                    onChange={(e) => update('airline', e.target.value)}
                    className="mkt-input"
                  />
                </Field>
                <Field label="Role">
                  <input
                    type="text"
                    placeholder="e.g. OCC Duty Manager"
                    value={form.role}
                    onChange={(e) => update('role', e.target.value)}
                    className="mkt-input"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    className="mkt-input"
                  />
                </Field>
                <Field label="Country">
                  <select
                    value={form.country}
                    onChange={(e) => update('country', e.target.value)}
                    className="mkt-input"
                  >
                    <option value="">Select…</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="How did you hear about us?">
                  <select value={form.source} onChange={(e) => update('source', e.target.value)} className="mkt-input">
                    <option value="">Select…</option>
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-5">
                <Field label="Message" required error={fieldErrors.message}>
                  <textarea
                    rows={5}
                    placeholder="Tell us about your fleet, your current stack, and what you're hoping to improve."
                    value={form.message}
                    onChange={(e) => update('message', e.target.value)}
                    className="mkt-input resize-none"
                  />
                </Field>
              </div>

              <label className="mt-5 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => update('consent', e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[var(--mkt-accent)]"
                />
                <span className="text-[13px] leading-[1.55]" style={{ color: 'var(--mkt-text-dim)' }}>
                  I agree to SkyHub storing my submission so a sales engineer can contact me. No marketing spam — ever.
                </span>
              </label>
              {fieldErrors.consent && (
                <div className="text-[13px] font-medium mt-2" style={{ color: '#FF3B3B' }}>
                  {fieldErrors.consent}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-7 inline-flex items-center gap-2 h-12 px-7 rounded-xl text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, var(--mkt-accent) 0%, var(--mkt-accent-violet) 100%)',
                  boxShadow: '0 12px 32px -8px rgba(62,123,250,0.6)',
                }}
              >
                <Send size={15} strokeWidth={2.4} />
                {submitting ? 'Sending…' : 'Send message'}
              </button>
            </motion.form>
          </div>
        </div>
      </section>

      <style>{`
        .mkt-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--mkt-border);
          background: var(--mkt-surface);
          color: var(--mkt-text);
          font-size: 14px;
          font-weight: 400;
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
        }
        textarea.mkt-input {
          height: auto;
          padding: 10px 12px;
          line-height: 1.5;
        }
        select.mkt-input {
          appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'><path d='M1 1.5L6 6.5L11 1.5' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 36px;
        }
        .mkt-input::placeholder {
          color: var(--mkt-text-dim);
          opacity: 0.6;
        }
        .mkt-input:focus {
          border-color: var(--mkt-accent);
          box-shadow: 0 0 0 3px rgba(62,123,250,0.18);
        }
      `}</style>
    </>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="text-[13px] font-semibold mb-1.5" style={{ color: 'var(--mkt-text)' }}>
        {label}
        {required && <span style={{ color: 'var(--mkt-accent)' }}> *</span>}
      </div>
      {children}
      {error && (
        <div className="text-[13px] font-medium mt-1.5" style={{ color: '#FF3B3B' }}>
          {error}
        </div>
      )}
    </label>
  )
}
