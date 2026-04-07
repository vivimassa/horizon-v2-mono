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
  /** Input type: text, number, toggle, or select */
  inputType?: "text" | "number" | "toggle" | "select";
  /** Options for select input type */
  selectOptions?: string[];
}

export function FieldRow({
  label,
  value,
  editing,
  fieldKey,
  editValue,
  onChange,
  inputType = "text",
  selectOptions,
}: FieldRowProps) {
  if (editing && fieldKey && onChange) {
    return (
      <div className="py-2.5 border-b border-hz-border/50">
        <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
          {label}
        </div>
        {inputType === "toggle" ? (
          <button
            onClick={() => onChange(fieldKey, !editValue)}
            className="text-[13px] font-medium px-2.5 py-1 rounded-lg transition-colors"
            style={{
              backgroundColor: editValue ? "rgba(6,194,112,0.12)" : "rgba(255,59,59,0.12)",
              color: editValue ? "#06C270" : "#E63535",
            }}
          >
            {editValue ? "Yes" : "No"}
          </button>
        ) : inputType === "select" && selectOptions ? (
          <select
            value={editValue != null ? String(editValue) : ""}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
          >
            {selectOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
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
      <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
        {label}
      </div>
      <div className="text-[13px] font-medium">{value ?? "—"}</div>
    </div>
  );
}
