'use client'

import type { CrewMemberRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { SectionCard } from '../common/section-card'
import { Field, FieldGrid, TextInput, CheckboxField } from '../common/field'
import { crewAccent } from '../common/draft-helpers'

interface Props {
  crewId: string | null
  isDraft: boolean
  member: CrewMemberRef
  onFieldChange: (field: keyof CrewMemberRef, value: CrewMemberRef[keyof CrewMemberRef]) => void
}

export function OperationsTab({ member, onFieldChange }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  return (
    <>
      <SectionCard title="Hotel / Accommodation" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <Field
          label="No Accommodation Airports"
          palette={palette}
          hint="Comma-separated IATA codes — crew will not be assigned a hotel at these stations"
        >
          <TextInput
            value={member.noAccommodationAirports.join(', ')}
            onChange={(v) =>
              onFieldChange(
                'noAccommodationAirports',
                (v ?? '')
                  .split(',')
                  .map((x) => x.trim().toUpperCase())
                  .filter(Boolean),
              )
            }
            palette={palette}
            isDark={isDark}
            uppercase
          />
        </Field>
        <div className="h-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
          <CheckboxField
            label="Transport Required"
            description="Dispatch hotel transport between airport and accommodation"
            checked={member.transportRequired}
            onChange={(v) => onFieldChange('transportRequired', v)}
            palette={palette}
            isDark={isDark}
          />
          <CheckboxField
            label="Hotel At Home Base"
            description="Provide a hotel even at the home base (e.g. reserve crew)"
            checked={member.hotelAtHomeBase}
            onChange={(v) => onFieldChange('hotelAtHomeBase', v)}
            palette={palette}
            isDark={isDark}
          />
        </div>
      </SectionCard>

      <SectionCard title="Travel & Payroll" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <FieldGrid cols={3}>
          <Field label="Residence → Airport (minutes)" palette={palette}>
            <TextInput
              value={member.travelTimeMinutes}
              onChange={(v) => onFieldChange('travelTimeMinutes', v ? Number(v) : null)}
              type="number"
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Payroll Number" palette={palette}>
            <TextInput
              value={member.payrollNumber}
              onChange={(v) => onFieldChange('payrollNumber', v)}
              mono
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Min Guarantee (block hrs)" palette={palette}>
            <TextInput
              value={member.minGuarantee}
              onChange={(v) => onFieldChange('minGuarantee', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
      </SectionCard>
    </>
  )
}
