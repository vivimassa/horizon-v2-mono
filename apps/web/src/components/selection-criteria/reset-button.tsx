'use client'

interface ResetButtonProps {
  onClick: () => void
}

/** Secondary reset button — below Go button */
export function ResetButton({ onClick }: ResetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-[13px] text-hz-text-secondary hover:text-hz-text transition-colors py-1"
    >
      Reset
    </button>
  )
}
