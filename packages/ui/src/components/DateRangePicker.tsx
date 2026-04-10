import { useState, useMemo, useCallback, memo } from 'react'
import { Text, View, Pressable } from 'react-native'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native'
import { accentTint, type Palette } from '../theme/colors'

interface DateRangePickerProps {
  from: string
  to: string
  onChangeFrom: (iso: string) => void
  onChangeTo: (iso: string) => void
  accent: string
  palette: Palette
  isDark: boolean
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseISO(iso: string): { y: number; m: number; d: number } | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null
  return { y, m: m - 1, d }
}

function formatDisplay(iso: string): string {
  const p = parseISO(iso)
  if (!p) return ''
  return `${String(p.d).padStart(2, '0')}/${String(p.m + 1).padStart(2, '0')}/${p.y}`
}

function isSameDay(a: string, b: string): boolean {
  return a === b && a !== ''
}

function isInRange(iso: string, from: string, to: string): boolean {
  if (!from || !to || !iso) return false
  return iso > from && iso < to
}

export const DateRangePicker = memo(function DateRangePicker({
  from, to, onChangeFrom, onChangeTo, accent, palette, isDark,
}: DateRangePickerProps) {
  const [picking, setPicking] = useState<'from' | 'to'>('from')

  // Calendar view state
  const now = new Date()
  const initParsed = parseISO(from) ?? { y: now.getFullYear(), m: now.getMonth() }
  const [viewYear, setViewYear] = useState(initParsed.y)
  const [viewMonth, setViewMonth] = useState(initParsed.m)

  const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate())

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    // Monday-based: 0=Mon, 6=Sun
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const cells: { day: number; month: number; year: number; iso: string; isCurrentMonth: boolean }[] = []

    // Previous month trailing days
    for (let i = startDow - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const m = viewMonth - 1 < 0 ? 11 : viewMonth - 1
      const y = viewMonth - 1 < 0 ? viewYear - 1 : viewYear
      cells.push({ day: d, month: m, year: y, iso: toISO(y, m, d), isCurrentMonth: false })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, iso: toISO(viewYear, viewMonth, d), isCurrentMonth: true })
    }

    // Next month leading days (fill to 42 cells = 6 rows)
    while (cells.length < 42) {
      const d = cells.length - startDow - daysInMonth + 1
      const m = viewMonth + 1 > 11 ? 0 : viewMonth + 1
      const y = viewMonth + 1 > 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, month: m, year: y, iso: toISO(y, m, d), isCurrentMonth: false })
    }

    return cells
  }, [viewYear, viewMonth])

  const handleDayPress = useCallback((iso: string) => {
    if (picking === 'from') {
      onChangeFrom(iso)
      onChangeTo('')
      setPicking('to')
    } else {
      if (iso < from) {
        // Auto-swap
        onChangeTo(from)
        onChangeFrom(iso)
      } else {
        onChangeTo(iso)
      }
      setPicking('from')
    }
  }, [picking, from, onChangeFrom, onChangeTo])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleClear = () => { onChangeFrom(''); onChangeTo(''); setPicking('from') }
  const handleToday = () => {
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString('en', { month: 'long', year: 'numeric' })

  const rangeTint = accentTint(accent, isDark ? 0.12 : 0.08)
  const pillActiveBg = accent
  const pillInactiveBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const pillBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'

  return (
    <View>
      {/* From / To pills */}
      <View className="flex-row" style={{ gap: 6, marginBottom: 8 }}>
        <Pressable onPress={() => setPicking('from')}
          className="flex-1 flex-row items-center justify-center rounded-lg"
          style={{
            height: 36,
            backgroundColor: picking === 'from' ? pillActiveBg : (from ? pillInactiveBg : pillInactiveBg),
            borderWidth: picking === 'from' ? 0 : 1,
            borderColor: from ? accent : pillBorder,
            gap: 5,
          }}>
          <CalendarDays size={13} color={picking === 'from' ? '#fff' : (from ? accent : palette.textTertiary)} strokeWidth={1.8} />
          <Text style={{
            fontSize: 13, fontWeight: '600', fontFamily: 'monospace',
            color: picking === 'from' ? '#fff' : (from ? palette.text : palette.textTertiary),
          }}>
            {from ? formatDisplay(from) : 'From\u2026'}
          </Text>
        </Pressable>

        <Pressable onPress={() => setPicking('to')}
          className="flex-1 flex-row items-center justify-center rounded-lg"
          style={{
            height: 36,
            backgroundColor: picking === 'to' ? pillActiveBg : (to ? pillInactiveBg : pillInactiveBg),
            borderWidth: picking === 'to' ? 0 : 1,
            borderColor: to ? accent : pillBorder,
            gap: 5,
          }}>
          <CalendarDays size={13} color={picking === 'to' ? '#fff' : (to ? accent : palette.textTertiary)} strokeWidth={1.8} />
          <Text style={{
            fontSize: 13, fontWeight: '600', fontFamily: 'monospace',
            color: picking === 'to' ? '#fff' : (to ? palette.text : palette.textTertiary),
          }}>
            {to ? formatDisplay(to) : 'To\u2026'}
          </Text>
        </Pressable>
      </View>

      {/* Calendar */}
      <View className="rounded-xl" style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        padding: 8,
      }}>
        {/* Month navigation */}
        <View className="flex-row items-center justify-between" style={{ marginBottom: 8 }}>
          <Pressable onPress={prevMonth} className="items-center justify-center active:opacity-60"
            style={{ width: 32, height: 32 }}>
            <ChevronLeft size={16} color={palette.textSecondary} strokeWidth={2} />
          </Pressable>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{monthLabel}</Text>
          <Pressable onPress={nextMonth} className="items-center justify-center active:opacity-60"
            style={{ width: 32, height: 32 }}>
            <ChevronRight size={16} color={palette.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Day-of-week headers */}
        <View className="flex-row" style={{ marginBottom: 4 }}>
          {DAYS.map(d => (
            <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: palette.textTertiary }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Date grid — 6 rows × 7 columns */}
        {Array.from({ length: 6 }).map((_, rowIdx) => (
          <View key={rowIdx} className="flex-row">
            {calendarDays.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
              const isFrom = isSameDay(cell.iso, from)
              const isTo = isSameDay(cell.iso, to)
              const inRange = isInRange(cell.iso, from, to)
              const isToday = cell.iso === todayISO

              // Range background styling
              let cellBg = 'transparent'
              let borderRadiusStyle = {}
              if (isFrom && to) {
                cellBg = accent
                borderRadiusStyle = { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }
              } else if (isTo && from) {
                cellBg = accent
                borderRadiusStyle = { borderTopRightRadius: 8, borderBottomRightRadius: 8 }
              } else if (isFrom && !to) {
                cellBg = accent
                borderRadiusStyle = { borderRadius: 8 }
              } else if (inRange) {
                cellBg = rangeTint
              }

              const textColor = (isFrom || isTo) ? '#fff'
                : !cell.isCurrentMonth ? palette.textTertiary
                : palette.text

              return (
                <Pressable key={colIdx} onPress={() => handleDayPress(cell.iso)}
                  className="items-center justify-center"
                  style={{
                    flex: 1, height: 36,
                    backgroundColor: cellBg,
                    ...borderRadiusStyle,
                  }}>
                  <Text style={{ fontSize: 13, fontWeight: (isFrom || isTo) ? '700' : '500', color: textColor }}>
                    {cell.day}
                  </Text>
                  {/* Today dot */}
                  {isToday && !isFrom && !isTo && (
                    <View style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: accent }} />
                  )}
                </Pressable>
              )
            })}
          </View>
        ))}

        {/* Footer */}
        <View className="flex-row items-center justify-between" style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
          <Pressable onPress={handleClear} className="active:opacity-60">
            <Text style={{ fontSize: 13, fontWeight: '500', color: palette.textSecondary }}>Clear</Text>
          </Pressable>
          <Pressable onPress={handleToday} className="active:opacity-60">
            <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Today</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
})
