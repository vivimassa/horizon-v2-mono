"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import type { SelectOption } from "./select";

interface MultiSelectProps {
  selected: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
}

/** Multi-value dropdown select with chips */
export function MultiSelect({
  selected,
  onChange,
  options,
  placeholder = "Select…",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const selectedLabels = options.filter((o) => selected.includes(o.value));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full min-h-[36px] px-3 rounded-xl text-[13px] border border-black/20 dark:border-white/20 bg-white dark:bg-hz-card transition-colors hover:border-black/30"
      >
        <span className="flex-1 text-left truncate">
          {selectedLabels.length > 0 ? (
            <span className="flex items-center gap-1 flex-wrap">
              {selectedLabels.slice(0, 2).map((o) => (
                <span
                  key={o.value}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-module-bg text-[11px] font-medium"
                >
                  {o.label}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-hz-cancelled"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(o.value);
                    }}
                  />
                </span>
              ))}
              {selectedLabels.length > 2 && (
                <span className="text-[11px] text-hz-text-secondary">
                  +{selectedLabels.length - 2}
                </span>
              )}
            </span>
          ) : (
            <span className="text-hz-text-secondary/50">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-hz-text-secondary shrink-0 ml-1 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-hz-border bg-white dark:bg-hz-card shadow-lg max-h-[240px] overflow-y-auto py-1">
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] hover:bg-hz-border/30 transition-colors"
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    checked
                      ? "bg-module-accent border-module-accent"
                      : "border-black/20 dark:border-white/20"
                  }`}
                >
                  {checked && <Check className="h-3 w-3 text-white" />}
                </div>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
