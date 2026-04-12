'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { GitBranch, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

interface ScenarioSaveDialogProps {
  scenarioName: string
  onSave: (name: string, description: string) => void
  onPublish: (name: string, description: string) => void
  onDiscard: () => void
  onClose: () => void
}

export function ScenarioSaveDialog({ scenarioName, onSave, onPublish, onDiscard, onClose }: ScenarioSaveDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const [name, setName] = useState(scenarioName)
  const [description, setDescription] = useState('')

  const bg = isDark ? '#1C1C28' : '#FAFAFC'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="rounded-2xl w-[420px] overflow-hidden"
        style={{ background: bg, border: `1px solid ${border}`, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: isDark ? 'rgba(91,141,239,0.15)' : 'rgba(30,64,175,0.10)' }}
          >
            <GitBranch size={16} color={isDark ? '#5B8DEF' : '#1e40af'} />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold" style={{ color: palette.text }}>
              Save Scenario
            </div>
            <div className="text-[13px]" style={{ color: palette.textTertiary }}>
              Name and save your changes
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: palette.textTertiary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-[13px] font-medium block mb-1.5" style={{ color: palette.textSecondary }}>
              Scenario Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full h-10 px-3 rounded-lg text-[14px] outline-none transition-colors"
              style={{
                background: inputBg,
                border: `1px solid ${inputBorder}`,
                color: palette.text,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = isDark ? '#5B8DEF' : '#1e40af'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = inputBorder
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) onSave(name.trim(), description.trim())
              }}
            />
          </div>
          <div>
            <label className="text-[13px] font-medium block mb-1.5" style={{ color: palette.textSecondary }}>
              Description <span style={{ color: palette.textTertiary }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-[14px] outline-none resize-none transition-colors"
              style={{
                background: inputBg,
                border: `1px solid ${inputBorder}`,
                color: palette.text,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = isDark ? '#5B8DEF' : '#1e40af'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = inputBorder
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: `1px solid ${border}` }}>
          <button
            onClick={onDiscard}
            className="px-4 h-9 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: '#E63535', color: '#fff' }}
          >
            Discard
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-lg text-[13px] font-medium transition-colors"
            style={{ border: `1px solid ${border}`, color: palette.textSecondary }}
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim(), description.trim())}
            disabled={!name.trim()}
            className="px-4 h-9 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: isDark ? '#5B8DEF' : '#1e40af' }}
          >
            Save Draft
          </button>
          <button
            onClick={() => name.trim() && onPublish(name.trim(), description.trim())}
            disabled={!name.trim()}
            className="px-4 h-9 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#06C270' }}
          >
            Publish
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
