import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  required?: boolean;
  children: ReactNode;
}

/** Wrapper for a filter input — displays uppercase label above the control */
export function Field({ label, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-semibold uppercase tracking-wider text-hz-text-secondary">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
