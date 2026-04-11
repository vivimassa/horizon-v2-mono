import type { ReactNode } from 'react'

interface ListItemProps {
  selected: boolean
  onClick: () => void
  children: ReactNode
}

/** Selectable list item with left accent bar when active */
export function ListItem({ selected, onClick, children }: ListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center w-full text-left px-3 py-2.5 rounded-xl transition-colors duration-150 ${
        selected
          ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
          : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
      }`}
    >
      {children}
    </button>
  )
}
