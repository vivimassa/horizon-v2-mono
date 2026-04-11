'use client'

import { Loader2 } from 'lucide-react'

interface GoButtonProps {
  onClick: () => void
  loading?: boolean
  label?: string
  disabled?: boolean
}

/** Primary action button — pinned in SelectionPanel footer */
export function GoButton({ onClick, loading = false, label = 'Go', disabled = false }: GoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-9 rounded-xl bg-module-accent text-white text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </button>
  )
}
