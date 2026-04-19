'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  type CrewMemberCreate,
  type CrewMemberListItemRef,
  type CrewMemberRef,
  type FullCrewProfileRef,
} from '@skyhub/api'
import { useCrewList, useCrewProfile } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { CrewProfileIndex } from './crew-profile-index'
import { CrewProfileDetail } from './crew-profile-detail'
import { CrewProfileRightPanel } from './crew-profile-right-panel'
import { diffShallow } from './common/draft-helpers'
import { useCtrlS, useUnsavedGuard } from './common/hot-keys'
import type { AircraftQualificationsGridHandle } from './grid/aircraft-qualifications-grid'

export const DRAFT_ID = '__draft__'

function emptyCrewDraft(): CrewMemberRef {
  return {
    _id: DRAFT_ID,
    operatorId: '',
    employeeId: '',
    firstName: '',
    middleName: null,
    lastName: '',
    shortCode: null,
    gender: null,
    dateOfBirth: null,
    nationality: null,
    base: null,
    position: null,
    status: 'active',
    employmentDate: null,
    exitDate: null,
    exitReason: null,
    contractType: null,
    seniority: null,
    seniorityGroup: 0,
    languages: [],
    apisAlias: null,
    countryOfResidence: null,
    residencePermitNo: null,
    emailPrimary: null,
    emailSecondary: null,
    addressLine1: null,
    addressLine2: null,
    addressCity: null,
    addressState: null,
    addressZip: null,
    addressCountry: null,
    emergencyName: null,
    emergencyRelationship: null,
    emergencyPhone: null,
    noAccommodationAirports: [],
    transportRequired: false,
    hotelAtHomeBase: false,
    travelTimeMinutes: null,
    payrollNumber: null,
    minGuarantee: null,
    flyWithSeniorUntil: null,
    doNotScheduleAltPosition: null,
    standbyExempted: false,
    crewUnderTraining: false,
    noDomesticFlights: false,
    noInternationalFlights: false,
    maxLayoverStops: null,
    photoUrl: null,
    createdAt: '',
    updatedAt: '',
  }
}

export function CrewProfileShell() {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<{ base?: string; position?: string; status?: string; aircraftType?: string }>(
    {},
  )
  const listQuery = useCrewList({ ...filters, search: search || undefined })
  const list: CrewMemberListItemRef[] = useMemo(() => listQuery.data ?? [], [listQuery.data])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const profileQuery = useCrewProfile(selectedId && selectedId !== DRAFT_ID ? selectedId : null)

  // Draft states
  const [newDraft, setNewDraft] = useState<CrewMemberRef | null>(null)
  const [memberDraft, setMemberDraft] = useState<CrewMemberRef | null>(null)
  const savedRef = useRef<CrewMemberRef | null>(null)
  const gridRef = useRef<AircraftQualificationsGridHandle | null>(null)
  const [draftReadyQualCount, setDraftReadyQualCount] = useState(0)

  // Keep an internal copy of the profile for right panel + tabs
  const serverProfile: FullCrewProfileRef | null = profileQuery.data ?? null

  // Sync memberDraft whenever server profile changes (on load or after save).
  useEffect(() => {
    if (selectedId === DRAFT_ID) {
      if (!newDraft) setNewDraft(emptyCrewDraft())
      setMemberDraft(newDraft ?? emptyCrewDraft())
      savedRef.current = null
      return
    }
    if (serverProfile) {
      setMemberDraft(serverProfile.member)
      savedRef.current = serverProfile.member
    } else {
      setMemberDraft(null)
      savedRef.current = null
    }
  }, [serverProfile, selectedId, newDraft])

  // Select the first item by default
  useEffect(() => {
    if (selectedId) return
    if (list.length > 0) setSelectedId(list[0]._id)
  }, [list, selectedId])

  const isDirty = useMemo(() => {
    if (selectedId === DRAFT_ID) {
      if (!memberDraft) return false
      return !!(memberDraft.employeeId || memberDraft.firstName || memberDraft.lastName)
    }
    if (!memberDraft || !savedRef.current) return false
    return JSON.stringify(memberDraft) !== JSON.stringify(savedRef.current)
  }, [memberDraft, selectedId])

  useUnsavedGuard(isDirty)

  const handleStartCreate = useCallback(() => {
    setNewDraft(emptyCrewDraft())
    setSelectedId(DRAFT_ID)
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      if (isDirty) {
        if (!confirm('You have unsaved changes. Discard them?')) return
      }
      setSelectedId(id)
      setNewDraft(null)
    },
    [isDirty],
  )

  const handleSave = useCallback(async () => {
    if (!memberDraft) return
    if (selectedId === DRAFT_ID) {
      if (!memberDraft.employeeId.trim() || !memberDraft.firstName.trim() || !memberDraft.lastName.trim()) {
        alert('Employee ID, First Name, and Last Name are required.')
        return
      }
      const readyQualCount = gridRef.current?.getReadyCount() ?? 0
      if (readyQualCount === 0) {
        alert('At least one Aircraft Type Qualification is required (A/C Type + Position).')
        return
      }
      const payload: CrewMemberCreate = {
        employeeId: memberDraft.employeeId.trim(),
        firstName: memberDraft.firstName.trim(),
        lastName: memberDraft.lastName.trim(),
        middleName: memberDraft.middleName,
        shortCode: memberDraft.shortCode,
        gender: memberDraft.gender,
        dateOfBirth: memberDraft.dateOfBirth,
        nationality: memberDraft.nationality,
        base: memberDraft.base,
        position: memberDraft.position,
        status: memberDraft.status,
        employmentDate: memberDraft.employmentDate,
      }
      const created = await api.createCrewMember(payload)
      // Flush the in-memory qualification rows now that the crew has an id.
      try {
        await gridRef.current?.flushToCrew(created._id)
      } catch (e) {
        console.error('Failed to save queued qualifications:', e)
      }
      setNewDraft(null)
      setDraftReadyQualCount(0)
      setSelectedId(created._id)
      await listQuery.refetch()
      return
    }
    if (!savedRef.current) return
    const patch = diffShallow(
      savedRef.current as unknown as Record<string, unknown>,
      memberDraft as unknown as Record<string, unknown>,
    )
    if (Object.keys(patch).length === 0) return
    await api.updateCrewMember(memberDraft._id, patch as Partial<CrewMemberRef>)
    await Promise.all([listQuery.refetch(), profileQuery.refetch()])
  }, [memberDraft, selectedId, listQuery, profileQuery])

  const handleCancel = useCallback(() => {
    if (selectedId === DRAFT_ID) {
      setNewDraft(null)
      setSelectedId(list[0]?._id ?? null)
      return
    }
    if (savedRef.current) setMemberDraft(savedRef.current)
  }, [selectedId, list])

  // Ctrl+S fires whenever we have something saveable — a dirty existing crew
  // or a draft with all requireds (employeeId/firstName/lastName) AND at
  // least one ready qualification row. The save handler itself re-validates.
  const canSaveDraft =
    selectedId === DRAFT_ID &&
    !!memberDraft?.employeeId.trim() &&
    !!memberDraft?.firstName.trim() &&
    !!memberDraft?.lastName.trim() &&
    draftReadyQualCount > 0
  useCtrlS(handleSave, isDirty || canSaveDraft)

  const handleFieldChange = useCallback(
    (field: keyof CrewMemberRef, value: CrewMemberRef[keyof CrewMemberRef]) => {
      setMemberDraft((prev) => {
        if (!prev) return prev
        const next = { ...prev, [field]: value }
        if (selectedId === DRAFT_ID) setNewDraft(next)
        return next
      })
    },
    [selectedId],
  )

  const handleAvatarChange = useCallback(
    async (newUrl: string | null) => {
      if (selectedId === DRAFT_ID || !memberDraft) return
      setMemberDraft({ ...memberDraft, photoUrl: newUrl })
      savedRef.current = savedRef.current ? { ...savedRef.current, photoUrl: newUrl } : null
      await Promise.all([listQuery.refetch(), profileQuery.refetch()])
    },
    [selectedId, memberDraft, listQuery, profileQuery],
  )

  return (
    <MasterDetailLayout
      left={
        <CrewProfileIndex
          list={list}
          loading={listQuery.isLoading}
          selectedId={selectedId}
          search={search}
          filters={filters}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onSelect={handleSelect}
          onStartCreate={handleStartCreate}
        />
      }
      center={
        selectedId && memberDraft ? (
          <CrewProfileDetail
            crewId={selectedId === DRAFT_ID ? null : selectedId}
            isDraft={selectedId === DRAFT_ID}
            member={memberDraft}
            serverProfile={serverProfile}
            isDirty={isDirty}
            onFieldChange={handleFieldChange}
            onSave={handleSave}
            onCancel={handleCancel}
            onRefresh={async () => {
              await Promise.all([listQuery.refetch(), profileQuery.refetch()])
            }}
            gridRef={gridRef}
            onGridReadyCountChange={setDraftReadyQualCount}
            draftReadyQualCount={draftReadyQualCount}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-hz-text-secondary text-[13px]">
            Select a crew member or click <strong className="mx-1">+ New Crew</strong> to create one
          </div>
        )
      }
      right={
        selectedId && memberDraft ? (
          <CrewProfileRightPanel
            crewId={selectedId === DRAFT_ID ? null : selectedId}
            member={memberDraft}
            serverProfile={serverProfile}
            onAvatarChange={handleAvatarChange}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[13px] text-hz-text-tertiary p-4 text-center">
            No crew selected.
          </div>
        )
      }
    />
  )
}
