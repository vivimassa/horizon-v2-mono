import { useState, memo, useCallback } from 'react'
import { Text, View, ScrollView, Pressable } from 'react-native'
import {
  Plus,
  Trash2,
  Scissors,
  Copy,
  ClipboardPaste,
  Paintbrush,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Palette,
  Search,
  Replace,
  Upload,
  Download,
  Save,
  BookCopy,
  GitBranch,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutGrid,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useScheduleGridStore } from '../../stores/useScheduleGridStore'
import { ColorPickerPopover } from './color-picker-popover'

interface RibbonToolbarProps {
  onAddFlight: () => void
  onInsertFlight: () => void
  onDeleteFlight: () => void
  onSave: () => void
  onImport?: () => void
  onExport?: () => void
  onScenario?: () => void
  onMessage?: () => void
  onFind?: () => void
  onReplace?: () => void
  onSaveAs?: () => void
  hasDirty: boolean
  hasSelection: boolean
  saving: boolean
  palette: PaletteType
  accent: string
  isDark: boolean
}

export const RibbonToolbar = memo(function RibbonToolbar({
  onAddFlight,
  onInsertFlight,
  onDeleteFlight,
  onSave,
  onImport,
  onExport,
  onScenario,
  onMessage,
  onFind,
  onReplace,
  onSaveAs,
  hasDirty,
  hasSelection,
  saving,
  palette,
  accent,
  isDark,
}: RibbonToolbarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [colorPicker, setColorPicker] = useState<{ type: 'text' | 'bg' } | null>(null)

  const store = useScheduleGridStore()
  const formatPainterActive = store.formatPainterSource !== null

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const handleColorPick = useCallback(
    (color: string) => {
      const type = colorPicker?.type
      if (!type) return
      const { selectedCell, rows, deletedIds, setCellFormat } = useScheduleGridStore.getState()
      if (!selectedCell) return
      const allRows = rows.filter((r) => !deletedIds.has(r._id))
      const row = allRows[selectedCell.rowIdx]
      if (row) {
        setCellFormat(
          row._id,
          selectedCell.colKey,
          type === 'text' ? { textColor: color || undefined } : { bgColor: color || undefined },
        )
      }
    },
    [colorPicker],
  )

  if (collapsed) {
    return (
      <View
        style={{
          backgroundColor: glassBg,
          borderWidth: 1,
          borderColor: glassBorder,
          borderRadius: 16,
          margin: 8,
          marginBottom: 4,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 4, height: 52, gap: 2 }}
        >
          <SmBtn icon={Plus} onPress={onAddFlight} palette={palette} isDark={isDark} />
          <SmBtn icon={Trash2} onPress={onDeleteFlight} disabled={!hasSelection} palette={palette} isDark={isDark} />
          <Divider isDark={isDark} />
          <SmBtn
            icon={Scissors}
            onPress={() => store.cutCell()}
            disabled={!hasSelection}
            palette={palette}
            isDark={isDark}
          />
          <SmBtn
            icon={Copy}
            onPress={() => store.copyCell()}
            disabled={!hasSelection}
            palette={palette}
            isDark={isDark}
          />
          <SmBtn icon={ClipboardPaste} onPress={() => store.pasteCell()} palette={palette} isDark={isDark} />
          <Divider isDark={isDark} />
          <SmBtn
            icon={Bold}
            onPress={() => store.toggleBold()}
            disabled={!hasSelection}
            palette={palette}
            isDark={isDark}
          />
          <SmBtn
            icon={Italic}
            onPress={() => store.toggleItalic()}
            disabled={!hasSelection}
            palette={palette}
            isDark={isDark}
          />
          <SmBtn
            icon={Underline}
            onPress={() => store.toggleUnderline()}
            disabled={!hasSelection}
            palette={palette}
            isDark={isDark}
          />
          <Divider isDark={isDark} />
          <SmBtn icon={Search} onPress={onFind} palette={palette} isDark={isDark} />
          <SmBtn icon={Upload} onPress={onImport} palette={palette} isDark={isDark} />
          <SmBtn icon={Download} onPress={onExport} palette={palette} isDark={isDark} />
          <SmBtn icon={Save} onPress={onSave} disabled={!hasDirty || saving} palette={palette} isDark={isDark} />
          <SmBtn icon={GitBranch} onPress={onScenario} palette={palette} isDark={isDark} />
          <SmBtn icon={MessageSquare} onPress={onMessage} palette={palette} isDark={isDark} />
          <View style={{ width: 8 }} />
          <Pressable
            onPress={() => setCollapsed(false)}
            className="items-center justify-center"
            style={{ width: 32, height: 32 }}
          >
            <ChevronDown size={14} color={palette.textTertiary} strokeWidth={2} />
          </Pressable>
        </ScrollView>
      </View>
    )
  }

  return (
    <View
      style={{
        backgroundColor: glassBg,
        borderWidth: 1,
        borderColor: glassBorder,
        borderRadius: 16,
        margin: 8,
        marginBottom: 4,
        height: 110,
        overflow: 'hidden',
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ height: 110, alignItems: 'stretch' }}
      >
        {/* Flight */}
        <RibbonSection label="Flight">
          <LgBtn icon={Plus} label="Add" onPress={onAddFlight} palette={palette} isDark={isDark} />
          <LgBtn
            icon={Trash2}
            label="Remove"
            onPress={onDeleteFlight}
            disabled={!hasSelection}
            palette={palette}
            isDark={isDark}
          />
        </RibbonSection>
        <Divider isDark={isDark} vertical />

        {/* Clipboard */}
        <RibbonSection label="Clipboard">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: 88 }}>
            <SmBtn
              icon={Scissors}
              onPress={() => store.cutCell()}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
            <SmBtn
              icon={Copy}
              onPress={() => store.copyCell()}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
            <SmBtn icon={ClipboardPaste} onPress={() => store.pasteCell()} palette={palette} isDark={isDark} />
            <SmBtn
              icon={Paintbrush}
              onPress={() => store.activateFormatPainter()}
              disabled={!hasSelection}
              active={formatPainterActive}
              palette={palette}
              isDark={isDark}
            />
          </View>
        </RibbonSection>
        <Divider isDark={isDark} vertical />

        {/* Font & Alignment */}
        <RibbonSection label="Font & Alignment">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: 180 }}>
            {/* Row 1: B I U | Text color | Fill color */}
            <SmBtn
              icon={Bold}
              onPress={() => store.toggleBold()}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
            <SmBtn
              icon={Italic}
              onPress={() => store.toggleItalic()}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
            <SmBtn
              icon={Underline}
              onPress={() => store.toggleUnderline()}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
            <SmBtn
              icon={Type}
              onPress={() => setColorPicker({ type: 'text' })}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
            {/* Row 2: Fill color | Align L C R */}
            <SmBtn
              icon={Palette}
              onPress={() => setColorPicker({ type: 'bg' })}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
            <SmBtn
              icon={AlignLeft}
              onPress={() => applyAlign('left')}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
            <SmBtn
              icon={AlignCenter}
              onPress={() => applyAlign('center')}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
            <SmBtn
              icon={AlignRight}
              onPress={() => applyAlign('right')}
              disabled={!hasSelection}
              palette={palette}
              isDark={isDark}
            />
          </View>
        </RibbonSection>
        <Divider isDark={isDark} vertical />

        {/* Cells */}
        <RibbonSection label="Cells">
          <SmBtn icon={ArrowDownToLine} onPress={onInsertFlight} palette={palette} isDark={isDark} />
          <SmBtn
            icon={ArrowUpFromLine}
            onPress={onDeleteFlight}
            disabled={!hasSelection}
            palette={palette}
            isDark={isDark}
          />
        </RibbonSection>
        <Divider isDark={isDark} vertical />

        {/* Editing */}
        <RibbonSection label="Editing">
          <SmBtn icon={Search} onPress={onFind} palette={palette} isDark={isDark} />
          <SmBtn icon={Replace} onPress={onReplace} palette={palette} isDark={isDark} />
        </RibbonSection>
        <Divider isDark={isDark} vertical />

        {/* Import */}
        <RibbonSection label="Import">
          <LgBtn icon={Upload} label="Upload" onPress={onImport} palette={palette} isDark={isDark} />
          <LgBtn icon={Download} label="Download" onPress={onExport} palette={palette} isDark={isDark} />
        </RibbonSection>
        <Divider isDark={isDark} vertical />

        {/* Record */}
        <RibbonSection label="Record">
          <LgBtn
            icon={Save}
            label="Save"
            onPress={onSave}
            disabled={!hasDirty || saving}
            palette={palette}
            isDark={isDark}
            highlight
          />
          <LgBtn icon={BookCopy} label="Save As" onPress={onSaveAs} palette={palette} isDark={isDark} />
        </RibbonSection>
        <Divider isDark={isDark} vertical />

        {/* Scenario */}
        <RibbonSection label="Scenario">
          <LgBtn icon={GitBranch} label="Scenario" onPress={onScenario} palette={palette} isDark={isDark} />
        </RibbonSection>
        <Divider isDark={isDark} vertical />

        {/* Message */}
        <RibbonSection label="Message">
          <LgBtn icon={MessageSquare} label="ASM/SSM" onPress={onMessage} palette={palette} isDark={isDark} />
        </RibbonSection>

        {/* Collapse */}
        <View style={{ justifyContent: 'flex-start', paddingTop: 8, paddingRight: 8, marginLeft: 'auto' as any }}>
          <Pressable
            onPress={() => setCollapsed(true)}
            className="items-center justify-center"
            style={{ width: 28, height: 28 }}
          >
            <ChevronUp size={14} color={palette.textTertiary} strokeWidth={2} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Color picker modal */}
      <ColorPickerPopover
        visible={colorPicker !== null}
        title={colorPicker?.type === 'text' ? 'Font Color' : 'Fill Color'}
        onPick={handleColorPick}
        onClose={() => setColorPicker(null)}
        palette={palette}
        isDark={isDark}
      />
    </View>
  )
})

function applyAlign(align: 'left' | 'center' | 'right') {
  const { selectedCell, rows, deletedIds, setCellFormat } = useScheduleGridStore.getState()
  if (!selectedCell) return
  const allRows = rows.filter((r) => !deletedIds.has(r._id))
  const row = allRows[selectedCell.rowIdx]
  if (row) setCellFormat(row._id, selectedCell.colKey, { textAlign: align })
}

// ── Sub-components ──

function RibbonSection({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingTop: 8,
        paddingBottom: 4,
        paddingHorizontal: wide ? 16 : 12,
        height: 110,
      }}
    >
      <View style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, flex: 1 }}>
        {children}
      </View>
      <View
        style={{
          width: '100%',
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: 'rgba(128,128,128,0.1)',
          paddingTop: 3,
          marginTop: 3,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(128,128,128,0.5)' }}>{label}</Text>
      </View>
    </View>
  )
}

function LgBtn({
  icon: Icon,
  label,
  onPress,
  disabled,
  highlight,
  palette,
  isDark,
}: {
  icon: LucideIcon
  label: string
  onPress?: () => void
  disabled?: boolean
  highlight?: boolean
  palette: PaletteType
  isDark: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="items-center justify-center rounded-lg active:opacity-70"
      style={{
        width: 68,
        height: 68,
        opacity: disabled ? 0.3 : 1,
        backgroundColor: highlight ? (isDark ? 'rgba(22,163,74,0.15)' : 'rgba(22,163,74,0.08)') : undefined,
      }}
    >
      <Icon
        size={24}
        color={highlight ? '#16a34a' : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'}
        strokeWidth={1.4}
      />
      <Text
        style={{ fontSize: 12, fontWeight: '500', color: highlight ? '#16a34a' : palette.textSecondary, marginTop: 4 }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function SmBtn({
  icon: Icon,
  onPress,
  disabled,
  active,
  palette,
  isDark,
}: {
  icon: LucideIcon
  onPress?: () => void
  disabled?: boolean
  active?: boolean
  palette: PaletteType
  isDark: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="items-center justify-center rounded active:opacity-70"
      style={{
        width: 40,
        height: 40,
        opacity: disabled ? 0.3 : 1,
        backgroundColor: active ? (isDark ? 'rgba(62,123,250,0.20)' : 'rgba(30,64,175,0.12)') : undefined,
      }}
    >
      <Icon
        size={20}
        color={active ? (isDark ? '#5B8DEF' : '#1e40af') : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'}
        strokeWidth={1.6}
      />
    </Pressable>
  )
}

function Divider({ isDark, vertical }: { isDark: boolean; vertical?: boolean }) {
  if (vertical) {
    return (
      <View style={{ justifyContent: 'center', paddingVertical: 16 }}>
        <View
          style={{ width: 1, height: '60%', backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }}
        />
      </View>
    )
  }
  return (
    <View
      style={{
        width: 1,
        height: 20,
        backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
        marginHorizontal: 2,
      }}
    />
  )
}

function MiniDivider({ isDark }: { isDark: boolean }) {
  return (
    <View
      style={{
        width: 1,
        height: 20,
        backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
        marginHorizontal: 2,
      }}
    />
  )
}
