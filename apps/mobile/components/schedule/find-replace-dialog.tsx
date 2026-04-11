import { useState, useCallback, memo } from 'react'
import { Text, View, Pressable, TextInput } from 'react-native'
import { X, Search, ChevronDown, ChevronUp } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import type { ScheduledFlightRef } from '@skyhub/api'
import { GRID_COLUMNS } from './grid-columns'

interface FindReplaceDialogProps {
  visible: boolean
  onClose: () => void
  flights: ScheduledFlightRef[]
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>
  onReplace: (id: string, colKey: string, value: string) => void
  palette: Palette
  accent: string
  isDark: boolean
}

export const FindReplaceDialog = memo(function FindReplaceDialog({
  visible,
  onClose,
  flights,
  dirtyMap,
  onReplace,
  palette,
  accent,
  isDark,
}: FindReplaceDialogProps) {
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)

  const getVal = useCallback(
    (flight: ScheduledFlightRef, key: string): string => {
      const dirty = dirtyMap.get(flight._id)
      const val = dirty && key in dirty ? (dirty as any)[key] : (flight as any)[key]
      return val != null ? String(val) : ''
    },
    [dirtyMap],
  )

  const findMatches = useCallback(() => {
    if (!findText) {
      setMatchCount(0)
      return []
    }
    const matches: { id: string; colKey: string; value: string }[] = []
    const q = caseSensitive ? findText : findText.toLowerCase()
    const cols = GRID_COLUMNS.filter((c) => c.editable)
    for (const flight of flights) {
      for (const col of cols) {
        const val = getVal(flight, col.key)
        const cmp = caseSensitive ? val : val.toLowerCase()
        if (cmp.includes(q)) matches.push({ id: flight._id, colKey: col.key, value: val })
      }
    }
    setMatchCount(matches.length)
    return matches
  }, [findText, caseSensitive, flights, getVal])

  const handleFind = useCallback(() => {
    const matches = findMatches()
    if (matches.length > 0) setCurrentMatch(1)
  }, [findMatches])

  const handleReplaceOne = useCallback(() => {
    const matches = findMatches()
    if (matches.length === 0 || currentMatch <= 0) return
    const match = matches[currentMatch - 1]
    if (!match) return
    const newVal = match.value.replace(
      new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi'),
      replaceText,
    )
    onReplace(match.id, match.colKey, newVal)
    setCurrentMatch((prev) => Math.min(prev, matchCount - 1))
  }, [findMatches, currentMatch, findText, replaceText, caseSensitive, matchCount, onReplace])

  const handleReplaceAll = useCallback(() => {
    const matches = findMatches()
    for (const match of matches) {
      const newVal = match.value.replace(
        new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi'),
        replaceText,
      )
      onReplace(match.id, match.colKey, newVal)
    }
    setMatchCount(0)
    setCurrentMatch(0)
  }, [findMatches, findText, replaceText, caseSensitive, onReplace])

  if (!visible) return null

  return (
    <View
      style={{
        position: 'absolute',
        top: 4,
        right: 12,
        zIndex: 100,
        width: 320,
        backgroundColor: isDark ? 'rgba(25,25,33,0.97)' : 'rgba(255,255,255,0.98)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderRadius: 14,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        padding: 14,
      }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>
          {showReplace ? 'Find & Replace' : 'Find'}
        </Text>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Pressable onPress={() => setShowReplace((prev) => !prev)} className="active:opacity-60">
            {showReplace ? (
              <ChevronUp size={14} color={palette.textTertiary} />
            ) : (
              <ChevronDown size={14} color={palette.textTertiary} />
            )}
          </Pressable>
          <Pressable onPress={onClose} className="active:opacity-60">
            <X size={16} color={palette.textTertiary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Find input */}
      <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
        <TextInput
          value={findText}
          onChangeText={setFindText}
          placeholder="Search..."
          placeholderTextColor={palette.textTertiary}
          onSubmitEditing={handleFind}
          style={{
            flex: 1,
            fontSize: 14,
            color: palette.text,
            fontFamily: 'monospace',
            borderWidth: 1,
            borderColor: palette.cardBorder,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: palette.card,
          }}
        />
        <Pressable
          onPress={handleFind}
          className="items-center justify-center rounded-lg active:opacity-70"
          style={{ width: 34, height: 34, backgroundColor: accent }}
        >
          <Search size={14} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Replace input */}
      {showReplace && (
        <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
          <TextInput
            value={replaceText}
            onChangeText={setReplaceText}
            placeholder="Replace with..."
            placeholderTextColor={palette.textTertiary}
            style={{
              flex: 1,
              fontSize: 14,
              color: palette.text,
              fontFamily: 'monospace',
              borderWidth: 1,
              borderColor: palette.cardBorder,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: palette.card,
            }}
          />
        </View>
      )}

      {/* Options row */}
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Pressable
          onPress={() => setCaseSensitive((prev) => !prev)}
          className="flex-row items-center"
          style={{ gap: 4 }}
        >
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              borderWidth: 1.5,
              borderColor: caseSensitive ? accent : palette.textTertiary,
              backgroundColor: caseSensitive ? accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {caseSensitive && <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>Aa</Text>}
          </View>
          <Text style={{ fontSize: 13, color: palette.textSecondary }}>Case</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {matchCount > 0 && (
          <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>
            {currentMatch}/{matchCount}
          </Text>
        )}
        {matchCount === 0 && findText.length > 0 && (
          <Text style={{ fontSize: 13, color: palette.textTertiary }}>No matches</Text>
        )}
      </View>

      {/* Replace buttons */}
      {showReplace && (
        <View className="flex-row mt-2" style={{ gap: 6 }}>
          <Pressable
            onPress={handleReplaceOne}
            disabled={matchCount === 0}
            className="flex-1 items-center py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), opacity: matchCount === 0 ? 0.4 : 1 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Replace</Text>
          </Pressable>
          <Pressable
            onPress={handleReplaceAll}
            disabled={matchCount === 0}
            className="flex-1 items-center py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accent, opacity: matchCount === 0 ? 0.4 : 1 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Replace All</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
})
