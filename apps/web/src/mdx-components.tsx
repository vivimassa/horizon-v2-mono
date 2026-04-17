import type { MDXComponents } from 'mdx/types'
import { Term } from '@/components/help'
import { Kbd, Step, Callout, Shortcut, ShortcutList } from '@/components/help/help-mdx-primitives'

const components: MDXComponents = {
  h1: ({ children }) => <h1 className="text-[18px] font-bold text-hz-text leading-tight mb-2">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2 flex items-center gap-2 text-[15px] font-semibold text-hz-text leading-snug">
      <span className="inline-block w-[3px] h-[14px] rounded-sm bg-module-accent" />
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mt-4 mb-1.5 text-[14px] font-semibold text-hz-text">{children}</h3>,
  p: ({ children }) => <p className="text-[14px] text-hz-text/90 leading-[1.6] mb-3">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 space-y-1 text-[14px] text-hz-text/90 leading-[1.6]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 space-y-1 text-[14px] text-hz-text/90 leading-[1.6]">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-module-accent hover:underline font-medium"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="inline-block px-1.5 py-0.5 rounded-md border border-hz-border bg-black/5 dark:bg-white/5 font-mono text-[13px]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 p-3 rounded-lg border border-hz-border bg-black/5 dark:bg-white/5 font-mono text-[13px] overflow-x-auto leading-snug">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-3 border-l-2 border-module-accent/40 text-[14px] text-hz-text-secondary italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-0 h-px bg-hz-border" />,
  strong: ({ children }) => <strong className="font-semibold text-hz-text">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-hz-border">
      <table className="w-full text-[13px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-black/5 dark:bg-white/5">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-hz-border last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-[13px] font-semibold text-hz-text-secondary uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2 text-[13px] text-hz-text/90 leading-[1.5] align-top">{children}</td>,

  // Sky Hub help primitives
  Term,
  Kbd,
  Step,
  Callout,
  Shortcut,
  ShortcutList,
}

export function useMDXComponents(): MDXComponents {
  return components
}
