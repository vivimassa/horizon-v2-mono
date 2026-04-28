import { useQuery } from '@tanstack/react-query'
import { crewApi, type LegWx } from '../lib/api-client'

export function useLegWx(dep: string | null | undefined, arr: string | null | undefined) {
  return useQuery<LegWx>({
    queryKey: ['leg-wx', dep ?? '', arr ?? ''],
    queryFn: () => crewApi.legWx(dep!, arr!),
    enabled: !!(dep && arr && dep.length === 4 && arr.length === 4),
    staleTime: 10 * 60_000,
  })
}
