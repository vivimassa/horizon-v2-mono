'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getBreadcrumbChain } from '@skyhub/constants'

export function Breadcrumbs() {
  const pathname = usePathname()
  const chain = getBreadcrumbChain(pathname)

  if (chain.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-6 py-3 text-[13px] min-h-[44px]">
      {chain.map((entry, i) => {
        const isLast = i === chain.length - 1
        return (
          <span key={entry.code} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-hz-text-secondary/50" />}
            {isLast ? (
              <span className="text-hz-text">
                <span className="font-semibold">{entry.code}</span> {entry.name}
              </span>
            ) : (
              <Link
                href={entry.route}
                className="text-hz-text-secondary hover:text-hz-text transition-colors duration-150"
              >
                <span className="font-semibold">{entry.code}</span> {entry.name}
              </Link>
            )}
          </span>
        )
      })}
    </div>
  )
}
