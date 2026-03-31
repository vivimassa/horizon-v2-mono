"use client";

interface SegmentOption {
  value: string;
  label: string;
}

interface SegmentedProps {
  value: string;
  onChange: (value: string) => void;
  options: SegmentOption[];
}

/** Mutually exclusive pill selector */
export function Segmented({ value, onChange, options }: SegmentedProps) {
  return (
    <div className="flex rounded-xl border border-black/10 dark:border-white/10 bg-hz-card p-0.5 gap-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-[12px] font-medium py-1.5 rounded-lg transition-colors duration-150 ${
              active
                ? "bg-module-accent/15 text-module-accent font-semibold shadow-sm"
                : "text-hz-text-secondary hover:text-hz-text"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
