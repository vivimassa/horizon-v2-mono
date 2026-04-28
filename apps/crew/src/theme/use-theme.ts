import { HORIZON, type Theme } from './tokens'
import { useScheme } from '../stores/use-theme-store'

export function useTheme(): Theme {
  const scheme = useScheme()
  return HORIZON[scheme]
}
