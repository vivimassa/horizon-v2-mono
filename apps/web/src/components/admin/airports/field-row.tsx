interface FieldRowProps {
  label: string;
  value: React.ReactNode;
}

/** Reusable read-only field row for detail tab forms */
export function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="py-2.5 border-b border-hz-border/50">
      <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1">
        {label}
      </div>
      <div className="text-[13px] font-medium">{value ?? "—"}</div>
    </div>
  );
}
