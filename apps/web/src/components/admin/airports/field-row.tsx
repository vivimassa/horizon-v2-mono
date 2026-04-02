interface FieldRowProps {
  label: string;
  value: React.ReactNode;
  /** When provided, field becomes editable */
  editing?: boolean;
  /** Field key for the onChange callback */
  fieldKey?: string;
  /** Current raw value for editing */
  editValue?: string | number | boolean | null;
  /** Called with (fieldKey, newValue) when user changes value */
  onChange?: (key: string, value: string | number | boolean | null) => void;
  /** Input type: text, number, or toggle */
  inputType?: "text" | "number" | "toggle";
}

export function FieldRow({
  label,
  value,
  editing,
  fieldKey,
  editValue,
  onChange,
  inputType = "text",
}: FieldRowProps) {
  if (editing && fieldKey && onChange) {
    return (
      <div className="py-2.5 border-b border-hz-border/50">
        <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1">
          {label}
        </div>
        {inputType === "toggle" ? (
          <button
            onClick={() => onChange(fieldKey, !editValue)}
            className="text-[13px] font-medium px-2.5 py-1 rounded-lg transition-colors"
            style={{
              backgroundColor: editValue ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
              color: editValue ? "#16a34a" : "#dc2626",
            }}
          >
            {editValue ? "Yes" : "No"}
          </button>
        ) : (
          <input
            type={inputType}
            value={editValue != null ? String(editValue) : ""}
            onChange={(e) => {
              const v = inputType === "number"
                ? (e.target.value === "" ? null : Number(e.target.value))
                : e.target.value;
              onChange(fieldKey, v);
            }}
            className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
          />
        )}
      </div>
    );
  }

  return (
    <div className="py-2.5 border-b border-hz-border/50">
      <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1">
        {label}
      </div>
      <div className="text-[13px] font-medium">{value ?? "—"}</div>
    </div>
  );
}
