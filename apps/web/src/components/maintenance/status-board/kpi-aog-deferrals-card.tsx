'use client'

import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

interface KpiAogDeferralsCardProps {
  aogCount: number
  deferralCount: number
  oldestDeferralDays: number | null
}

export function KpiAogDeferralsCard({ aogCount, deferralCount, oldestDeferralDays }: KpiAogDeferralsCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const aogColor = aogCount > 0 ? '#FF3B3B' : '#06C270'
  const deferralColor = deferralCount > 0 ? '#FF8800' : palette.textTertiary
  const oldestColor = oldestDeferralDays !== null && oldestDeferralDays > 14 ? '#FF3B3B' : '#FF8800'

  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : '#E4E4EB'

  return (
    <div
      className="rounded-xl p-3 flex flex-col"
      style={{
        background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.95)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <div className="text-[13px] font-semibold mb-2" style={{ color: palette.textSecondary }}>
        AOG & Deferrals
      </div>

      {/* Two large numbers side by side */}
      <div className="flex items-center justify-center flex-1 gap-0">
        {/* AOG */}
        <div className="flex-1 flex flex-col items-center">
          <span className="font-bold leading-none" style={{ fontSize: 36, color: aogColor }}>
            {aogCount}
          </span>
          <span className="text-[13px] mt-1" style={{ color: palette.textSecondary }}>
            AOG
          </span>
        </div>

        {/* Vertical divider */}
        <div className="w-[1px] self-stretch my-2" style={{ background: dividerColor }} />

        {/* Deferred */}
        <div className="flex-1 flex flex-col items-center">
          <span className="font-bold leading-none" style={{ fontSize: 36, color: deferralColor }}>
            {deferralCount}
          </span>
          <span className="text-[13px] mt-1" style={{ color: palette.textSecondary }}>
            Deferred
          </span>
        </div>
      </div>

      {/* Oldest deferral line */}
      {oldestDeferralDays !== null && (
        <div className="text-[13px] text-center mt-2" style={{ color: oldestColor }}>
          Oldest deferral: {oldestDeferralDays}d
        </div>
      )}
    </div>
  )
}
