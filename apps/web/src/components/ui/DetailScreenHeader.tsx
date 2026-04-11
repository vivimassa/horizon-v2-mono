'use client'

import type { ComponentType, ReactNode } from 'react'
import { ChevronLeft, Pencil, Save, X, Trash2, Loader2 } from 'lucide-react'
import { Text } from './Text'

type IconComponent = ComponentType<any>

export type StatusTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

interface StatusDescriptor {
  label: string
  tone: StatusTone
}

const STATUS_CLASSES: Record<StatusTone, string> = {
  success: 'bg-[rgba(6,194,112,0.12)] text-[#06C270]',
  danger: 'bg-[rgba(255,59,59,0.12)] text-[#E63535]',
  warning: 'bg-[rgba(255,136,0,0.12)] text-[#FF8800]',
  info: 'bg-[rgba(0,99,247,0.12)] text-[#0063F7]',
  neutral: 'bg-[rgba(128,128,140,0.12)] text-[#80808C]',
}

interface DetailScreenHeaderProps {
  icon?: IconComponent
  title: string
  subtitle?: string
  subtitleSlot?: ReactNode
  onBack?: () => void
  editing?: boolean
  onEdit?: () => void
  onSave?: () => void
  onCancel?: () => void
  onDelete?: () => void
  saving?: boolean
  status?: StatusDescriptor
}

export function DetailScreenHeader({
  icon: Icon,
  title,
  subtitle,
  subtitleSlot,
  onBack,
  editing = false,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  saving = false,
  status,
}: DetailScreenHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}

      {Icon ? (
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-module-accent/10">
          <Icon className="h-[18px] w-[18px] text-module-accent" />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Text variant="pageTitle" as="h1" className="truncate">
            {title}
          </Text>
          {status ? (
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-[16px] ${STATUS_CLASSES[status.tone]}`}
            >
              {status.label}
            </span>
          ) : null}
        </div>
        {subtitle || subtitleSlot ? (
          <div className="flex items-center gap-2 mt-0.5">
            {subtitle ? (
              <Text variant="secondary" muted as="div" className="truncate">
                {subtitle}
              </Text>
            ) : null}
            {subtitleSlot}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {editing ? (
          <>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
              >
                <X className="h-4 w-4" />
                <Text variant="cardTitle" as="span" className="!font-medium">
                  Cancel
                </Text>
              </button>
            ) : null}
            {onSave ? (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-module-accent text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <Text variant="cardTitle" as="span" className="!text-white !font-semibold">
                  Save
                </Text>
              </button>
            ) : null}
          </>
        ) : (
          <>
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-hz-text-secondary/70 hover:text-[#E63535] hover:bg-[#E63535]/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-module-accent/10 text-module-accent hover:bg-module-accent/15 transition-colors"
              >
                <Pencil className="h-4 w-4" />
                <Text variant="cardTitle" as="span" className="!text-module-accent !font-semibold">
                  Edit
                </Text>
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
