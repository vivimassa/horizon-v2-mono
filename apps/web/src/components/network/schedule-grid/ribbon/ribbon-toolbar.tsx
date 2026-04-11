'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useScheduleGridStore } from '@/stores/use-schedule-grid-store'
import { Dropdown } from '@/components/ui/dropdown'
import {
  Trash2,
  Scissors,
  Copy,
  ClipboardPaste,
  Bold,
  Italic,
  Underline,
  Plus,
  Minus,
  Search,
  Replace,
  Upload,
  Download,
  Save,
  SaveAll,
  GitBranch,
  MessageSquare,
  FileText,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'
import { FlightSection } from './flight-section'
import { ClipboardSection } from './clipboard-section'
import { FontSection } from './font-section'
import { CellsSection } from './cells-section'
import { UtilitySections } from './utility-sections'

interface RibbonToolbarProps {
  onAddFlight: () => void
  onInsertFlight: () => void
  onDeleteFlight: () => void
  onSave: () => void
  onImport?: () => void
  onExport?: () => void
  onScenario?: () => void
  onMessage?: () => void
  onSsimExport?: () => void
  onFind?: () => void
  onReplace?: () => void
  onSaveAs?: () => void
  hasDirty: boolean
  hasSelection: boolean
  saving: boolean
  rowHeight: number
  onRowHeightChange: (h: number) => void
}

export function RibbonToolbar({
  onAddFlight,
  onInsertFlight,
  onDeleteFlight,
  onSave,
  onImport,
  onExport,
  onScenario,
  onMessage,
  onSsimExport,
  onFind,
  onReplace,
  onSaveAs,
  hasDirty,
  hasSelection,
  saving,
  rowHeight,
  onRowHeightChange,
}: RibbonToolbarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'

  const [collapsed, setCollapsed] = useState(false)
  const [autoCollapsed, setAutoCollapsed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-collapse when container is too narrow for the full ribbon (~1200px threshold)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0 && w < 1200 && !collapsed) {
        setAutoCollapsed(true)
      } else if (w >= 1200 && autoCollapsed) {
        setAutoCollapsed(false)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [collapsed, autoCollapsed])

  const isCollapsed = collapsed || autoCollapsed

  // Collapsed icon-only items — ALL buttons from expanded ribbon
  const collapsedItems: {
    icon: typeof Save
    label: string
    tooltip: string
    onClick?: () => void
    disabled?: boolean
  }[] = [
    // Flight
    { icon: Plus, label: 'Add', tooltip: 'Add (Insert)', onClick: onAddFlight },
    { icon: Trash2, label: 'Remove', tooltip: 'Remove (Ctrl+Del)', onClick: onDeleteFlight, disabled: !hasSelection },
    // Clipboard
    { icon: Scissors, label: 'Cut', tooltip: 'Cut (Ctrl+X)', disabled: !hasSelection },
    { icon: Copy, label: 'Copy', tooltip: 'Copy (Ctrl+C)', disabled: !hasSelection },
    { icon: ClipboardPaste, label: 'Paste', tooltip: 'Paste (Ctrl+V)' },
    // Font
    { icon: Bold, label: 'Bold', tooltip: 'Bold (Ctrl+B)', disabled: !hasSelection },
    { icon: Italic, label: 'Italic', tooltip: 'Italic (Ctrl+I)', disabled: !hasSelection },
    { icon: Underline, label: 'Underline', tooltip: 'Underline (Ctrl+U)', disabled: !hasSelection },
    // Cells
    { icon: Plus, label: 'Insert', tooltip: 'Insert (Ctrl+Shift+=)', onClick: onInsertFlight },
    { icon: Minus, label: 'Delete', tooltip: 'Delete (Ctrl+-)', onClick: onDeleteFlight, disabled: !hasSelection },
    // Editing
    { icon: Search, label: 'Find', tooltip: 'Find (Ctrl+F)', onClick: onFind },
    { icon: Replace, label: 'Replace', tooltip: 'Replace (Ctrl+H)', onClick: onReplace },
    // Import
    { icon: Upload, label: 'Upload', tooltip: 'Upload', onClick: onImport },
    { icon: Download, label: 'Download', tooltip: 'Download', onClick: onExport },
    // Record
    { icon: Save, label: 'Save', tooltip: 'Save (Ctrl+S)', onClick: onSave, disabled: !hasDirty || saving },
    { icon: SaveAll, label: 'Save As', tooltip: 'Save As (F12)', onClick: onSaveAs },
    // Scenario & Message
    { icon: GitBranch, label: 'Scenario', tooltip: 'Scenario', onClick: onScenario },
    { icon: MessageSquare, label: 'ASM/SSM', tooltip: 'ASM/SSM', onClick: onMessage },
    { icon: FileText, label: 'SSIM', tooltip: 'SSIM', onClick: onSsimExport },
  ]

  return (
    <div
      ref={containerRef}
      className="flex items-stretch gap-0 rounded-2xl shrink-0 overflow-hidden"
      style={{
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(20px)',
        height: isCollapsed ? 52 : undefined,
        minHeight: isCollapsed ? 52 : 100,
        transition: 'min-height 250ms cubic-bezier(0.4, 0, 0.2, 1), height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {isCollapsed ? (
        /* ── Collapsed: icon-only row with inline font controls ── */
        <div
          className="flex items-center gap-0.5 px-2 w-full"
          style={{ height: 52, animation: 'bc-dropdown-in 150ms ease-out' }}
        >
          {collapsedItems.map((item, i) => (
            <span key={i} className="contents">
              <Tooltip content={item.tooltip}>
                <button
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 ${item.disabled ? 'opacity-30 pointer-events-none' : ''}`}
                  style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}
                  onMouseEnter={(e) => {
                    if (!item.disabled) e.currentTarget.style.background = hoverBg
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <item.icon size={18} strokeWidth={1.6} />
                </button>
              </Tooltip>
              {/* Insert font controls right after Underline (index 7) */}
              {i === 7 && <CollapsedFontControls isDark={isDark} hasSelection={hasSelection} />}
            </span>
          ))}
          <div className="flex-1" />
          <Tooltip content="Expand toolbar">
            <button
              onClick={() => {
                setCollapsed(false)
                setAutoCollapsed(false)
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = hoverBg
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <ChevronDown size={16} />
            </button>
          </Tooltip>
        </div>
      ) : (
        /* ── Expanded: full ribbon ── */
        <div
          className="flex items-stretch gap-0 w-full overflow-x-auto"
          style={{ minHeight: 100, animation: 'bc-dropdown-in 150ms ease-out' }}
        >
          <FlightSection onAdd={onAddFlight} onRemove={onDeleteFlight} hasSelection={hasSelection} />
          <Divider isDark={isDark} />
          <ClipboardSection hasSelection={hasSelection} />
          <Divider isDark={isDark} />
          <FontSection hasSelection={hasSelection} />
          <Divider isDark={isDark} />
          <CellsSection
            onInsert={onInsertFlight}
            onDelete={onDeleteFlight}
            hasSelection={hasSelection}
            rowHeight={rowHeight}
            onRowHeightChange={onRowHeightChange}
          />
          <Divider isDark={isDark} />
          <UtilitySections
            onSave={onSave}
            onImport={onImport}
            onExport={onExport}
            onScenario={onScenario}
            onMessage={onMessage}
            onSsimExport={onSsimExport}
            onFind={onFind}
            onReplace={onReplace}
            onSaveAs={onSaveAs}
            hasDirty={hasDirty}
            saving={saving}
          />

          {/* Collapse chevron */}
          <div className="flex items-start pt-2 pr-2 ml-auto">
            <Tooltip content="Collapse toolbar">
              <button
                onClick={() => setCollapsed(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hoverBg
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <ChevronUp size={14} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}

function CollapsedFontControls({ isDark, hasSelection }: { isDark: boolean; hasSelection: boolean }) {
  const setCellFormat = useScheduleGridStore((s) => s.setCellFormat)
  const selectedCell = useScheduleGridStore((s) => s.selectedCell)
  const rows = useScheduleGridStore((s) => s.rows)
  const deletedIds = useScheduleGridStore((s) => s.deletedIds)

  const [fontFamily, setFontFamily] = useState('Mono')
  const [fontSize, setFontSize] = useState('13')

  const FONT_OPTIONS = [
    { value: 'Mono', label: 'JetBrains Mono' },
    { value: 'Inter', label: 'Inter' },
    { value: 'SF Pro', label: 'SF Pro' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Arial', label: 'Arial' },
  ]
  const SIZE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24].map((s) => ({ value: String(s), label: String(s) }))

  const applyToCell = useCallback(
    (key: string, value: unknown) => {
      if (!selectedCell) return
      const allRows = rows.filter((r) => !deletedIds.has(r._id))
      const row = allRows[selectedCell.rowIdx]
      if (row) setCellFormat(row._id, selectedCell.colKey, { [key]: value })
    },
    [selectedCell, rows, deletedIds, setCellFormat],
  )

  return (
    <div className="flex items-center gap-1.5 ml-1.5">
      <Dropdown
        options={FONT_OPTIONS}
        value={fontFamily}
        onChange={(v) => {
          setFontFamily(v)
          applyToCell('fontFamily', v)
        }}
        size="sm"
        disabled={!hasSelection}
        className="w-[220px]"
      />
      <Dropdown
        options={SIZE_OPTIONS}
        value={fontSize}
        onChange={(v) => {
          setFontSize(v)
          applyToCell('fontSize', Number(v))
        }}
        size="sm"
        disabled={!hasSelection}
        className="w-[70px]"
      />
    </div>
  )
}

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <div className="self-stretch shrink-0 flex items-center py-4">
      <div style={{ width: 1, height: '60%', background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }} />
    </div>
  )
}
