'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MasterDetailLayout } from '@/components/layout'
import { api, queryKeys, type CrewDocumentStatusFilters, type CrewDocumentStatusRef } from '@skyhub/api'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { SelectionCriteriaPanel } from './selection-criteria-panel'
import { CrewListPanel } from './crew-list-panel'
import { FolderView } from './folder-view'

/** Three-pane shell for Crew Documents & Training Records (4.1.2).
 *
 *  Filters never apply until the user clicks **Go** — a durable preference
 *  in `.claude/memory/feedback_filters_go_gated.md`. We hold the filters as
 *  a *draft* and only commit them (+ run the status query) on Go.
 */
export function CrewDocumentsShell() {
  const qc = useQueryClient()

  // Draft filter state — mutated by the inputs; not sent to the API.
  const [draftFilters, setDraftFilters] = useState<CrewDocumentStatusFilters>({})
  // Committed filter state — sent to the API after clicking Go.
  const [filters, setFilters] = useState<CrewDocumentStatusFilters | null>(null)
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null)

  // The query only runs when `filters` is non-null (i.e. after the first Go).
  const statusQuery = useQuery<CrewDocumentStatusRef[]>({
    queryKey: queryKeys.crewDocuments.status(filters as Record<string, unknown> | undefined),
    queryFn: () => api.getCrewDocumentStatus(filters ?? undefined),
    enabled: !!filters,
    staleTime: 30 * 1000,
  })

  const crew = useMemo(() => statusQuery.data ?? [], [statusQuery.data])
  const runway = useRunwayLoading()

  const handleGo = async () => {
    const nextFilters = { ...draftFilters }
    setFilters(nextFilters)
    setSelectedCrewId(null)
    await runway.run(
      async () => {
        // Pre-fetch so the runway can mask the actual network latency.
        await qc.fetchQuery({
          queryKey: queryKeys.crewDocuments.status(nextFilters as Record<string, unknown>),
          queryFn: () => api.getCrewDocumentStatus(nextFilters),
          staleTime: 30 * 1000,
        })
      },
      'Loading crew documents…',
      'Done',
    )
  }

  // Mount the right-hand Crew List only after the user has actually run a
  // query. Before the first Go (and during the runway animation) the center
  // takes over the full workspace — either as an EmptyPanel (idle) or the
  // RunwayLoadingPanel (loading). Matches 2.1.1 Movement Control's pattern.
  const isIdle = !runway.active && !filters
  const showFull = runway.active || isIdle

  return (
    <MasterDetailLayout
      left={
        <SelectionCriteriaPanel
          draft={draftFilters}
          onDraftChange={setDraftFilters}
          onGo={() => void handleGo()}
          loading={runway.active || statusQuery.isFetching}
        />
      }
      center={
        runway.active ? (
          <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
        ) : isIdle ? (
          <EmptyPanel message="Set your selection criteria on the left and click Go to load the crew list" />
        ) : (
          <FolderView
            crewId={selectedCrewId}
            selectedCrew={crew.find((c) => c._id === selectedCrewId) ?? null}
            hasRunQuery={!!filters}
          />
        )
      }
      right={
        showFull ? undefined : (
          <CrewListPanel
            crew={crew}
            loading={statusQuery.isLoading || runway.active}
            hasRunQuery={!!filters}
            selectedCrewId={selectedCrewId}
            onSelectCrew={setSelectedCrewId}
          />
        )
      }
    />
  )
}
