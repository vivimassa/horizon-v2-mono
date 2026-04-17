'use client'

/**
 * Create / edit modal for 7.1.5.1 Consumers.
 *
 * Delivery mode picker at the top reveals mode-specific fields below:
 *   - pull_api: API key generation is server-side; this modal shows the
 *     plaintext key ONCE after successful create.
 *   - sftp: host, port, user, auth mechanism, target path, filename.
 *   - smtp: to, cc, bcc, subject template, attachment toggle.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Mail, RefreshCw, Server, X } from 'lucide-react'
import type { AsmSsmConsumerRef, AsmSsmConsumerUpsert, AsmSsmDeliveryMode } from '@skyhub/api'
import { api } from '@skyhub/api'

interface Props {
  operatorId: string
  existing: AsmSsmConsumerRef | null
  accent: string
  isDark: boolean
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  name: string
  contactEmail: string
  deliveryMode: AsmSsmDeliveryMode
  active: boolean
  pullApi: { ipAllowlistCsv: string }
  sftp: {
    host: string
    port: number
    user: string
    authType: 'password' | 'key'
    secretRef: string
    targetPath: string
    filenamePattern: string
  }
  smtp: {
    to: string
    ccCsv: string
    bccCsv: string
    subjectTemplate: string
    asAttachment: boolean
  }
}

const DEFAULT_STATE: FormState = {
  name: '',
  contactEmail: '',
  deliveryMode: 'pull_api',
  active: true,
  pullApi: { ipAllowlistCsv: '' },
  sftp: {
    host: '',
    port: 22,
    user: '',
    authType: 'password',
    secretRef: '',
    targetPath: '/',
    filenamePattern: '{operator}_{family}_{type}_{messageId}_{timestamp}.txt',
  },
  smtp: {
    to: '',
    ccCsv: '',
    bccCsv: '',
    subjectTemplate: '[{family}] {type} — {messageId}',
    asAttachment: false,
  },
}

function toState(ref: AsmSsmConsumerRef | null): FormState {
  if (!ref) return DEFAULT_STATE
  return {
    name: ref.name,
    contactEmail: ref.contactEmail ?? '',
    deliveryMode: ref.deliveryMode,
    active: ref.active,
    pullApi: {
      ipAllowlistCsv: (ref.pullApi?.ipAllowlist ?? []).join(', '),
    },
    sftp: {
      host: ref.sftp?.host ?? '',
      port: ref.sftp?.port ?? 22,
      user: ref.sftp?.user ?? '',
      authType: ref.sftp?.authType ?? 'password',
      secretRef: ref.sftp?.secretRef ?? '',
      targetPath: ref.sftp?.targetPath ?? '/',
      filenamePattern: ref.sftp?.filenamePattern ?? '{operator}_{family}_{type}_{messageId}_{timestamp}.txt',
    },
    smtp: {
      to: ref.smtp?.to ?? '',
      ccCsv: (ref.smtp?.cc ?? []).join(', '),
      bccCsv: (ref.smtp?.bcc ?? []).join(', '),
      subjectTemplate: ref.smtp?.subjectTemplate ?? '[{family}] {type} — {messageId}',
      asAttachment: Boolean(ref.smtp?.asAttachment),
    },
  }
}

function splitCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export function ConsumerFormModal({ operatorId, existing, accent, isDark, onClose, onSaved }: Props) {
  const [state, setState] = useState<FormState>(toState(existing))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [freshKey, setFreshKey] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => setState(toState(existing)), [existing])

  const isEdit = Boolean(existing)

  const payload = useMemo<AsmSsmConsumerUpsert>(() => {
    const base: AsmSsmConsumerUpsert = {
      operatorId,
      name: state.name.trim(),
      contactEmail: state.contactEmail.trim() || null,
      deliveryMode: state.deliveryMode,
      active: state.active,
    }
    if (state.deliveryMode === 'pull_api') {
      base.pullApi = { ipAllowlist: splitCsv(state.pullApi.ipAllowlistCsv) }
    }
    if (state.deliveryMode === 'sftp') {
      base.sftp = {
        host: state.sftp.host.trim(),
        port: state.sftp.port || 22,
        user: state.sftp.user.trim(),
        authType: state.sftp.authType,
        secretRef: state.sftp.secretRef || undefined,
        targetPath: state.sftp.targetPath || '/',
        filenamePattern: state.sftp.filenamePattern,
      }
    }
    if (state.deliveryMode === 'smtp') {
      base.smtp = {
        to: state.smtp.to.trim(),
        cc: splitCsv(state.smtp.ccCsv),
        bcc: splitCsv(state.smtp.bccCsv),
        subjectTemplate: state.smtp.subjectTemplate,
        asAttachment: state.smtp.asAttachment,
      }
    }
    return base
  }, [operatorId, state])

  const handleSave = useCallback(async () => {
    setError(null)
    setSaving(true)
    try {
      if (!payload.name) throw new Error('Name is required')
      if (isEdit && existing) {
        await api.updateAsmSsmConsumer(existing._id, {
          name: payload.name,
          contactEmail: payload.contactEmail,
          deliveryMode: payload.deliveryMode,
          active: payload.active,
          pullApi: payload.pullApi,
          sftp: payload.sftp,
          smtp: payload.smtp,
        })
        onSaved()
        onClose()
      } else {
        const res = await api.createAsmSsmConsumer(payload)
        if (res.apiKey) {
          setFreshKey(res.apiKey)
          setReveal(true)
        } else {
          onSaved()
          onClose()
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [payload, isEdit, existing, onSaved, onClose])

  const copyKey = async () => {
    if (!freshKey) return
    await navigator.clipboard.writeText(freshKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const finish = () => {
    onSaved()
    onClose()
  }

  const inputBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(96,97,112,0.06)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl w-full max-w-2xl mx-4 max-h-[88vh] flex flex-col overflow-hidden border"
        style={{
          background: isDark ? '#191921' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between gap-3"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
            <h2 className="text-[16px] font-bold text-hz-text">{isEdit ? 'Edit consumer' : 'New consumer'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-hz-text-secondary hover:bg-hz-border/30"
          >
            <X size={15} />
          </button>
        </div>

        {/* Fresh API key reveal (create flow only) */}
        {freshKey && (
          <div
            className="px-5 py-4 border-b"
            style={{ borderColor: 'rgba(6,194,112,0.25)', background: 'rgba(6,194,112,0.06)' }}
          >
            <div className="text-[13px] font-medium text-hz-text mb-1.5">API key generated — copy it now</div>
            <div className="flex items-center gap-2">
              <div
                className="h-10 px-3 rounded-lg text-[13px] font-mono flex items-center flex-1"
                style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
              >
                {reveal ? freshKey : '•'.repeat(Math.min(freshKey.length, 40))}
              </div>
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="h-10 w-10 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-border/30"
                style={{ border: `1px solid ${inputBorder}` }}
                title={reveal ? 'Hide' : 'Reveal'}
              >
                {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                type="button"
                onClick={copyKey}
                className="h-10 px-3 rounded-lg text-[13px] font-medium flex items-center gap-2 hover:bg-hz-border/30"
                style={{ border: `1px solid ${inputBorder}` }}
              >
                {copied ? <Check size={14} style={{ color: '#06C270' }} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="text-[13px] text-hz-text-secondary mt-1.5">
              This key will not be shown again. Rotate from the consumer row if lost.
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-5 space-y-4 overflow-y-auto">
          <Field label="Name" required>
            <Input
              value={state.name}
              onChange={(v) => setState((s) => ({ ...s, name: v }))}
              placeholder="e.g. Amadeus, Sabre, LocalAgency"
              isDark={isDark}
            />
          </Field>
          <Field label="Contact email">
            <Input
              value={state.contactEmail}
              onChange={(v) => setState((s) => ({ ...s, contactEmail: v }))}
              placeholder="their support contact, optional"
              isDark={isDark}
            />
          </Field>

          <Field label="Delivery mode">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: 'pull_api', label: 'Pull API', Icon: KeyRound },
                  { key: 'sftp', label: 'SFTP', Icon: Server },
                  { key: 'smtp', label: 'SMTP', Icon: Mail },
                ] as Array<{ key: AsmSsmDeliveryMode; label: string; Icon: typeof KeyRound }>
              ).map(({ key, label, Icon }) => {
                const active = state.deliveryMode === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setState((s) => ({ ...s, deliveryMode: key }))}
                    className="flex items-center gap-2 h-10 px-3 rounded-lg text-[13px] font-medium transition-colors"
                    style={{
                      background: active ? accent : inputBg,
                      color: active ? '#fff' : 'var(--color-hz-text-secondary)',
                      border: `1px solid ${active ? accent : inputBorder}`,
                    }}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                )
              })}
            </div>
          </Field>

          {state.deliveryMode === 'pull_api' && (
            <Field label="IP allowlist" help="Optional. Comma-separated. Leave blank to allow from anywhere.">
              <Input
                value={state.pullApi.ipAllowlistCsv}
                onChange={(v) => setState((s) => ({ ...s, pullApi: { ...s.pullApi, ipAllowlistCsv: v } }))}
                placeholder="10.0.0.0/8, 203.0.113.1"
                isDark={isDark}
              />
            </Field>
          )}

          {state.deliveryMode === 'sftp' && (
            <>
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Field label="Host" required>
                  <Input
                    value={state.sftp.host}
                    onChange={(v) => setState((s) => ({ ...s, sftp: { ...s.sftp, host: v } }))}
                    placeholder="sftp.vendor.com"
                    isDark={isDark}
                  />
                </Field>
                <Field label="Port">
                  <Input
                    value={String(state.sftp.port)}
                    onChange={(v) => setState((s) => ({ ...s, sftp: { ...s.sftp, port: parseInt(v, 10) || 22 } }))}
                    placeholder="22"
                    isDark={isDark}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="User" required>
                  <Input
                    value={state.sftp.user}
                    onChange={(v) => setState((s) => ({ ...s, sftp: { ...s.sftp, user: v } }))}
                    isDark={isDark}
                  />
                </Field>
                <Field label="Auth type">
                  <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: inputBorder }}>
                    {(['password', 'key'] as const).map((k) => {
                      const active = state.sftp.authType === k
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setState((s) => ({ ...s, sftp: { ...s.sftp, authType: k } }))}
                          className="h-10 px-4 text-[13px] font-medium flex-1"
                          style={{
                            background: active ? accent : 'transparent',
                            color: active ? '#fff' : 'var(--color-hz-text-secondary)',
                          }}
                        >
                          {k === 'password' ? 'Password' : 'SSH Key'}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </div>
              <Field label="Secret reference" help="Key or password ID in your secret store.">
                <Input
                  value={state.sftp.secretRef}
                  onChange={(v) => setState((s) => ({ ...s, sftp: { ...s.sftp, secretRef: v } }))}
                  placeholder="secrets/sftp/vendor-x"
                  isDark={isDark}
                />
              </Field>
              <Field label="Target path">
                <Input
                  value={state.sftp.targetPath}
                  onChange={(v) => setState((s) => ({ ...s, sftp: { ...s.sftp, targetPath: v } }))}
                  placeholder="/inbox/skyhub"
                  isDark={isDark}
                />
              </Field>
              <Field label="Filename pattern" help="Placeholders: {operator} {family} {type} {messageId} {timestamp}">
                <Input
                  value={state.sftp.filenamePattern}
                  onChange={(v) => setState((s) => ({ ...s, sftp: { ...s.sftp, filenamePattern: v } }))}
                  isDark={isDark}
                />
              </Field>
            </>
          )}

          {state.deliveryMode === 'smtp' && (
            <>
              <Field label="To" required>
                <Input
                  value={state.smtp.to}
                  onChange={(v) => setState((s) => ({ ...s, smtp: { ...s.smtp, to: v } }))}
                  placeholder="asm@vendor.com"
                  isDark={isDark}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CC">
                  <Input
                    value={state.smtp.ccCsv}
                    onChange={(v) => setState((s) => ({ ...s, smtp: { ...s.smtp, ccCsv: v } }))}
                    placeholder="optional, comma-separated"
                    isDark={isDark}
                  />
                </Field>
                <Field label="BCC">
                  <Input
                    value={state.smtp.bccCsv}
                    onChange={(v) => setState((s) => ({ ...s, smtp: { ...s.smtp, bccCsv: v } }))}
                    placeholder="optional, comma-separated"
                    isDark={isDark}
                  />
                </Field>
              </div>
              <Field label="Subject template" help="Placeholders: {family} {type} {messageId}">
                <Input
                  value={state.smtp.subjectTemplate}
                  onChange={(v) => setState((s) => ({ ...s, smtp: { ...s.smtp, subjectTemplate: v } }))}
                  isDark={isDark}
                />
              </Field>
              <Field label="Send as attachment">
                <button
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      smtp: { ...s.smtp, asAttachment: !s.smtp.asAttachment },
                    }))
                  }
                  className="h-10 px-3 rounded-lg text-[13px] font-medium"
                  style={{
                    background: state.smtp.asAttachment ? accent : inputBg,
                    color: state.smtp.asAttachment ? '#fff' : 'var(--color-hz-text-secondary)',
                    border: `1px solid ${state.smtp.asAttachment ? accent : inputBorder}`,
                  }}
                >
                  {state.smtp.asAttachment ? 'Attachment (.txt)' : 'Inline body'}
                </button>
              </Field>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between gap-3"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
        >
          {error ? (
            <div className="text-[13px] text-[#EF4444] truncate flex-1">{error}</div>
          ) : (
            <div className="text-[13px] text-hz-text-tertiary">
              {isEdit ? 'Changes apply immediately on save.' : 'Creating a consumer arms delivery.'}
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {freshKey ? (
              <button
                type="button"
                onClick={finish}
                className="h-10 px-5 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: accent }}
              >
                Done
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-4 rounded-xl text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-10 px-5 rounded-xl text-[13px] font-semibold text-white flex items-center gap-2 disabled:opacity-40"
                  style={{ background: accent }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create consumer'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  required,
  help,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  help?: string
}) {
  return (
    <div>
      <div className="text-[13px] font-medium text-hz-text-secondary mb-1.5">
        {label}
        {required && <span className="text-[#E63535] ml-0.5">*</span>}
      </div>
      {children}
      {help && <div className="text-[13px] text-hz-text-tertiary mt-1">{help}</div>}
    </div>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  isDark,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  isDark: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text outline-none focus:ring-2 focus:ring-offset-0"
      style={{
        background: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(96,97,112,0.06)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
      }}
    />
  )
}
