// Re-exports from @skyhub/logic so both web and mobile share a single
// source of truth for operator-driven date formatting.
export {
  formatDate,
  parseDate,
  normalizeToIso,
  datePlaceholder,
  DATE_FORMAT_OPTIONS,
  type DateFormatType,
} from '@skyhub/logic'
