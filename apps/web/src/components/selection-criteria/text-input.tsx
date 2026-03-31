interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/** Standard text input for filter panels */
export function TextInput({
  value,
  onChange,
  placeholder = "",
  mono,
  onKeyDown,
}: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`w-full min-h-[36px] px-3 rounded-xl text-[13px] border border-black/20 dark:border-white/20 bg-white dark:bg-hz-card outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 transition-colors ${
        mono ? "font-mono text-center" : ""
      }`}
    />
  );
}
