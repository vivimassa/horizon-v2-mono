interface SectionProps {
  title: string;
}

/** Group header for related filters — uppercase, non-collapsible */
export function Section({ title }: SectionProps) {
  return (
    <div className="pt-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-secondary">
        {title}
      </span>
    </div>
  );
}
