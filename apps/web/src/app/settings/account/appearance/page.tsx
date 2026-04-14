'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sun, Moon, Check, Palette, Sparkles, Monitor, Eye, Layers, Type, ALargeSmall } from 'lucide-react'
import { colors, accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useTheme } from '@/components/theme-provider'
import { useDisplay } from '@/components/display-provider'
import { ThemeToggleButton } from '@/components/ui/theme-toggle-button'
import { AnimatedThemeIcon } from '@/components/ui/animated-theme-icon'
import { TEXT_SCALE_OPTIONS, type TextScale } from '@/lib/fonts'

const ACCENT = '#1e40af'

const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'Blue', hex: '#1e40af' },
  { name: 'Teal', hex: '#0f766e' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Maroon', hex: '#991b1b' },
  { name: 'Amber', hex: '#b45309' },
  { name: 'Green', hex: '#15803d' },
  { name: 'Sky', hex: '#0369a1' },
  { name: 'Pink', hex: '#be185d' },
]

const GLASS = {
  light: {
    card: 'rgba(255,255,255,0.55)',
    cardBorder: 'rgba(0,0,0,0.06)',
    blur: 'blur(16px) saturate(160%)',
    shadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  dark: {
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.07)',
    blur: 'blur(16px) saturate(140%)',
    shadow: '0 2px 12px rgba(0,0,0,0.2)',
  },
}

export default function AppearancePage() {
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const glass = isDark ? GLASS.dark : GLASS.light

  const { textScale, setTextScale, fonts: F } = useDisplay()
  const [selectedAccent, setSelectedAccent] = useState(ACCENT)
  const [compactMode, setCompactMode] = useState(false)
  const [animatedBg, setAnimatedBg] = useState(true)
  const [reduceMotion, setReduceMotion] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-5 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer group transition-all duration-150"
          style={{
            color: palette.text,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)'
          }}
        >
          <ArrowLeft size={15} strokeWidth={2} className="transition-transform group-hover:-translate-x-0.5" />
          <span className="text-[13px] font-semibold">Settings</span>
        </button>
      </div>

      {/* Main: left preview + right controls */}
      <div className="flex flex-1 overflow-hidden gap-4 px-4 pb-4">
        {/* ── Left Panel: Live Preview ── */}
        <aside
          className="w-[300px] shrink-0 flex flex-col rounded-2xl border overflow-hidden"
          style={{
            background: glass.card,
            borderColor: glass.cardBorder,
            backdropFilter: glass.blur,
            WebkitBackdropFilter: glass.blur,
            boxShadow: glass.shadow,
          }}
        >
          {/* Preview header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: accentTint(selectedAccent, isDark ? 0.15 : 0.08) }}
              >
                <Eye size={16} style={{ color: selectedAccent }} strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[13px] font-bold" style={{ color: palette.text }}>
                  Live Preview
                </p>
                <p className="text-[13px]" style={{ color: palette.textTertiary }}>
                  Changes apply instantly
                </p>
              </div>
            </div>
          </div>

          <div className="mx-4" style={{ height: 0.5, backgroundColor: palette.border }} />

          {/* Mini preview of current theme */}
          <div className="px-5 py-5 flex-1">
            {/* Theme indicator */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2" style={{ color: selectedAccent }}>
                <AnimatedThemeIcon isDark={isDark} size={16} />
                <span className="text-[13px] font-semibold" style={{ color: palette.text }}>
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>
              <ThemeToggleButton size={36} iconSize={18} />
            </div>

            {/* Accent preview */}
            <p
              className="text-[13px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: palette.textTertiary }}
            >
              Active Accent
            </p>
            <div
              className="rounded-xl p-4 mb-5"
              style={{
                background: accentTint(selectedAccent, isDark ? 0.12 : 0.06),
                border: `1px solid ${accentTint(selectedAccent, 0.2)}`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: selectedAccent }}
                >
                  <Sparkles size={18} color="#fff" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: palette.text }}>
                    {ACCENT_PRESETS.find((p) => p.hex === selectedAccent)?.name ?? 'Custom'}
                  </p>
                  <p className="text-[13px] font-mono" style={{ color: palette.textSecondary }}>
                    {selectedAccent}
                  </p>
                </div>
              </div>
              {/* Sample elements */}
              <div className="flex items-center gap-2">
                <div
                  className="px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white"
                  style={{ backgroundColor: selectedAccent }}
                >
                  Button
                </div>
                <div
                  className="px-3 py-1.5 rounded-lg text-[13px] font-semibold"
                  style={{
                    color: selectedAccent,
                    backgroundColor: accentTint(selectedAccent, isDark ? 0.15 : 0.1),
                    border: `1px solid ${accentTint(selectedAccent, 0.25)}`,
                  }}
                >
                  Secondary
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAccent }} />
              </div>
            </div>

            {/* Interface toggles summary */}
            <p
              className="text-[13px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: palette.textTertiary }}
            >
              Interface
            </p>
            <div className="flex flex-col gap-2">
              <PreviewPill
                label="Compact mode"
                on={compactMode}
                palette={palette}
                accent={selectedAccent}
                isDark={isDark}
              />
              <PreviewPill
                label="Animated backgrounds"
                on={animatedBg}
                palette={palette}
                accent={selectedAccent}
                isDark={isDark}
              />
              <PreviewPill
                label="Reduce motion"
                on={reduceMotion}
                palette={palette}
                accent={selectedAccent}
                isDark={isDark}
              />
            </div>
          </div>
        </aside>

        {/* ── Right Panel: Controls ── */}
        <section className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* Theme Mode */}
            <GlassCard
              title="Theme Mode"
              icon={isDark ? Moon : Sun}
              palette={palette}
              isDark={isDark}
              glass={glass}
              accent={selectedAccent}
            >
              <p className="text-[13px] mb-4" style={{ color: palette.textSecondary }}>
                Choose between light and dark mode for the interface.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ThemeCard
                  label="Light"
                  icon={Sun}
                  isActive={!isDark}
                  palette={palette}
                  isDark={isDark}
                  accent={selectedAccent}
                  onClick={() => {
                    if (isDark) toggle()
                  }}
                  preview={
                    <div
                      className="w-full h-16 rounded-lg mb-2 overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)' }}
                    >
                      <div className="flex gap-1.5 p-2">
                        <div className="w-6 h-1.5 rounded-full bg-gray-300" />
                        <div className="w-10 h-1.5 rounded-full bg-gray-200" />
                      </div>
                      <div className="flex gap-1 px-2">
                        <div className="flex-1 h-5 rounded bg-white border border-gray-200" />
                        <div className="flex-1 h-5 rounded bg-white border border-gray-200" />
                      </div>
                    </div>
                  }
                />
                <ThemeCard
                  label="Dark"
                  icon={Moon}
                  isActive={isDark}
                  palette={palette}
                  isDark={isDark}
                  accent={selectedAccent}
                  onClick={() => {
                    if (!isDark) toggle()
                  }}
                  preview={
                    <div
                      className="w-full h-16 rounded-lg mb-2 overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #1e1e2e, #0f0f1a)' }}
                    >
                      <div className="flex gap-1.5 p-2">
                        <div className="w-6 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
                        <div
                          className="w-10 h-1.5 rounded-full"
                          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                        />
                      </div>
                      <div className="flex gap-1 px-2">
                        <div
                          className="flex-1 h-5 rounded"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        />
                        <div
                          className="flex-1 h-5 rounded"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        />
                      </div>
                    </div>
                  }
                />
              </div>
            </GlassCard>

            {/* Accent Color */}
            <GlassCard
              title="Accent Color"
              icon={Palette}
              palette={palette}
              isDark={isDark}
              glass={glass}
              accent={selectedAccent}
            >
              <p className="text-[13px] mb-4" style={{ color: palette.textSecondary }}>
                Used for buttons, active states, highlights, and navigation accents.
              </p>
              <div className="grid grid-cols-4 gap-2.5">
                {ACCENT_PRESETS.map((preset) => {
                  const isSelected = preset.hex === selectedAccent
                  return (
                    <button
                      key={preset.name}
                      onClick={() => setSelectedAccent(preset.hex)}
                      className="flex flex-col items-center gap-2 py-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: isSelected ? accentTint(preset.hex, isDark ? 0.12 : 0.06) : 'transparent',
                        border: `1.5px solid ${isSelected ? preset.hex : palette.border}`,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
                          e.currentTarget.style.borderColor = accentTint(preset.hex, 0.4)
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.borderColor = palette.border
                        }
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: preset.hex,
                          boxShadow: isSelected ? `0 0 0 3px ${accentTint(preset.hex, 0.25)}` : 'none',
                        }}
                      >
                        {isSelected && <Check size={14} color="#fff" strokeWidth={2.5} />}
                      </div>
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: isSelected ? preset.hex : palette.textSecondary }}
                      >
                        {preset.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </GlassCard>

            {/* Interface */}
            <GlassCard
              title="Interface"
              icon={Layers}
              palette={palette}
              isDark={isDark}
              glass={glass}
              accent={selectedAccent}
            >
              <SettingToggle
                label="Compact mode"
                description="Reduce spacing and padding throughout the interface"
                on={compactMode}
                onToggle={() => setCompactMode(!compactMode)}
                palette={palette}
                isDark={isDark}
                accent={selectedAccent}
              />
              <div className="mx-0" style={{ height: 0.5, backgroundColor: palette.border }} />
              <SettingToggle
                label="Animated backgrounds"
                description="Enable gradient animations on page backgrounds"
                on={animatedBg}
                onToggle={() => setAnimatedBg(!animatedBg)}
                palette={palette}
                isDark={isDark}
                accent={selectedAccent}
              />
              <div className="mx-0" style={{ height: 0.5, backgroundColor: palette.border }} />
              <SettingToggle
                label="Reduce motion"
                description="Minimize animations and transitions"
                on={reduceMotion}
                onToggle={() => setReduceMotion(!reduceMotion)}
                palette={palette}
                isDark={isDark}
                accent={selectedAccent}
              />
            </GlassCard>

            {/* Display & Readability */}
            <GlassCard
              title="Display & Readability"
              icon={ALargeSmall}
              palette={palette}
              isDark={isDark}
              glass={glass}
              accent={selectedAccent}
            >
              <p className="text-[13px] mb-4" style={{ color: palette.textSecondary }}>
                Adjust text size across the entire application.
              </p>

              {/* Text scale selector */}
              <div className="flex gap-2 mb-5">
                {TEXT_SCALE_OPTIONS.map((opt) => {
                  const active = opt.value === textScale
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTextScale(opt.value)}
                      className="flex-1 flex flex-col items-center py-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        backgroundColor: active
                          ? accentTint(selectedAccent, isDark ? 0.12 : 0.06)
                          : isDark
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.02)',
                        border: `1.5px solid ${active ? selectedAccent : palette.border}`,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.borderColor = palette.textTertiary
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.borderColor = palette.border
                      }}
                    >
                      <Type
                        size={
                          opt.value === 'small' ? 16 : opt.value === 'default' ? 20 : opt.value === 'large' ? 24 : 28
                        }
                        style={{ color: active ? selectedAccent : palette.textSecondary, marginBottom: 4 }}
                        strokeWidth={1.8}
                      />
                      <span
                        className="font-semibold"
                        style={{ fontSize: 13, color: active ? selectedAccent : palette.text }}
                      >
                        {opt.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Live preview */}
              <div
                className="rounded-xl p-4"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${palette.border}`,
                }}
              >
                <p
                  className="uppercase tracking-wider mb-2"
                  style={{ fontSize: 11, fontWeight: 600, color: palette.textTertiary }}
                >
                  Preview
                </p>
                <p className="font-bold mb-1" style={{ fontSize: F.lg, color: palette.text }}>
                  Section Header
                </p>
                <p className="font-medium mb-1" style={{ fontSize: F.md, color: palette.text }}>
                  This is body text at the current scale. All pages update instantly.
                </p>
                <p style={{ fontSize: F.sm, color: palette.textSecondary }}>
                  Secondary text for descriptions and subtitles.
                </p>
                <p style={{ fontSize: F.min, color: palette.textTertiary, marginTop: 4 }}>
                  Minimum text size — labels, badges, and timestamps.
                </p>
              </div>
            </GlassCard>
          </div>

          <div className="h-8" />
        </section>
      </div>
    </div>
  )
}

// ── Sub-components ──

function GlassCard({
  title,
  icon: Icon,
  palette,
  isDark,
  glass,
  accent,
  children,
}: {
  title: string
  icon: typeof Sun
  palette: PaletteType
  isDark: boolean
  glass: typeof GLASS.light
  accent: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: glass.card,
        borderColor: glass.cardBorder,
        backdropFilter: glass.blur,
        WebkitBackdropFilter: glass.blur,
        boxShadow: glass.shadow,
      }}
    >
      <div className="flex items-center gap-2.5 px-5 py-3" style={{ borderBottom: `1px solid ${palette.border}` }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
        >
          <Icon size={14} style={{ color: accent }} strokeWidth={1.8} />
        </div>
        <h3 className="text-[14px] font-bold" style={{ color: palette.text, letterSpacing: -0.2 }}>
          {title}
        </h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function ThemeCard({
  label,
  icon: Icon,
  isActive,
  palette,
  isDark,
  accent,
  onClick,
  preview,
}: {
  label: string
  icon: typeof Sun
  isActive: boolean
  palette: PaletteType
  isDark: boolean
  accent: string
  onClick: () => void
  preview: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center px-3 pt-3 pb-3 rounded-xl cursor-pointer transition-all"
      style={{
        background: isActive
          ? accentTint(accent, isDark ? 0.1 : 0.05)
          : isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.02)',
        border: `1.5px solid ${isActive ? accent : palette.border}`,
        boxShadow: isActive ? `0 0 0 1px ${accentTint(accent, 0.08)}` : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = palette.textTertiary
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = palette.border
      }}
    >
      {isActive && (
        <div
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: accent }}
        >
          <Check size={12} color="#fff" strokeWidth={2.5} />
        </div>
      )}
      {preview}
      <div className="flex items-center gap-1.5">
        <Icon size={15} strokeWidth={1.8} style={{ color: isActive ? accent : palette.textSecondary }} />
        <span className="text-[13px] font-semibold" style={{ color: isActive ? accent : palette.text }}>
          {label}
        </span>
      </div>
    </button>
  )
}

function SettingToggle({
  label,
  description,
  on,
  onToggle,
  palette,
  isDark,
  accent,
}: {
  label: string
  description: string
  on: boolean
  onToggle: () => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex-1 mr-4">
        <div className="text-[13px] font-medium" style={{ color: palette.text }}>
          {label}
        </div>
        <div className="text-[13px] mt-0.5" style={{ color: palette.textSecondary }}>
          {description}
        </div>
      </div>
      <button
        onClick={onToggle}
        className="relative w-[44px] h-[26px] rounded-full cursor-pointer transition-colors"
        style={{ backgroundColor: on ? accent : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }}
      >
        <div
          className="absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white transition-all"
          style={{
            left: on ? 21 : 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }}
        />
      </button>
    </div>
  )
}

function PreviewPill({
  label,
  on,
  palette,
  accent,
  isDark,
}: {
  label: string
  on: boolean
  palette: PaletteType
  accent: string
  isDark: boolean
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-lg"
      style={{
        background: on
          ? accentTint(accent, isDark ? 0.1 : 0.06)
          : isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.02)',
        border: `1px solid ${on ? accentTint(accent, 0.2) : palette.border}`,
      }}
    >
      <span className="text-[13px] font-medium" style={{ color: on ? palette.text : palette.textSecondary }}>
        {label}
      </span>
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: on ? accent : palette.textTertiary }} />
    </div>
  )
}
