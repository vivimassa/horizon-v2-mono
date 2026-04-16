/**
 * Returns inline style objects for a flight row based on its status.
 * Published = solid, normal (operational truth)
 * Draft = dashed border, italic, muted (proposed)
 * Cancelled = strikethrough, faded
 *
 * Note: Returns plain style objects compatible with React Native's StyleSheet.
 */

export function getFlightRowStyle(status: string): Record<string, string> {
  if (status === 'published') {
    return {
      borderTopWidth: '1',
      borderTopColor: '#e5e7eb',
      borderBottomWidth: '1',
      borderBottomColor: '#e5e7eb',
      fontStyle: 'normal',
      color: '#111827',
    }
  }
  if (status === 'draft') {
    return {
      borderTopWidth: '1',
      borderTopColor: '#d1d5db',
      borderBottomWidth: '1',
      borderBottomColor: '#d1d5db',
      fontStyle: 'italic',
      color: '#6b7280',
    }
  }
  if (status === 'cancelled') {
    return {
      borderTopWidth: '1',
      borderTopColor: '#f3f4f6',
      borderBottomWidth: '1',
      borderBottomColor: '#f3f4f6',
      fontStyle: 'normal',
      color: '#d1d5db',
      textDecorationLine: 'line-through',
    }
  }
  // Fallback (ready or unknown)
  return {
    borderTopWidth: '1',
    borderTopColor: '#e5e7eb',
    borderBottomWidth: '1',
    borderBottomColor: '#e5e7eb',
  }
}

/**
 * Status badge text + color for display in UI.
 */
export function getFlightStatusBadge(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'published':
      return { label: 'Published', color: '#111827', bg: '#f3f4f6' }
    case 'draft':
      return { label: 'Draft', color: '#64748B', bg: '#f1f5f9' }
    case 'cancelled':
      return { label: 'Cancelled', color: '#9ca3af', bg: '#f9fafb' }
    default:
      return { label: status, color: '#6b7280', bg: '#f3f4f6' }
  }
}
