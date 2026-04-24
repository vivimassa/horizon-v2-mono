import type { CrewHotelRef, HotelEmail } from '@skyhub/api'

interface Props {
  hotel: CrewHotelRef
  editing?: boolean
  draft?: Partial<CrewHotelRef>
  onChange?: (key: string, value: string | number | boolean | null) => void
}

export function CrewHotelContactsTab({ hotel }: Props) {
  const contact1 = hotel.contacts?.[0]
  const contact2 = hotel.contacts?.[1]

  return (
    <div className="px-6 pt-3 pb-6 space-y-6">
      <ContactCard title="Contact 1" name={contact1?.name} telephone={contact1?.telephone} fax={contact1?.fax} />
      <ContactCard title="Contact 2" name={contact2?.name} telephone={contact2?.telephone} fax={contact2?.fax} />

      <div>
        <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary mb-3 flex items-center gap-2">
          <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
          Emails
        </div>
        {hotel.emails && hotel.emails.length > 0 ? (
          <div className="space-y-1">
            {hotel.emails.map((e: HotelEmail) => (
              <div
                key={e._id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-hz-border bg-hz-card text-[13px]"
              >
                <span className="flex-1 truncate">{e.address}</span>
                {e.isDefault && (
                  <span className="px-1.5 py-0.5 rounded bg-module-accent/10 text-module-accent text-[13px] font-semibold">
                    Default
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-hz-text-secondary">No emails set</div>
        )}
      </div>
    </div>
  )
}

function ContactCard({
  title,
  name,
  telephone,
  fax,
}: {
  title: string
  name?: string | null
  telephone?: string | null
  fax?: string | null
}) {
  return (
    <div>
      <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary mb-3 flex items-center gap-2">
        <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LabelledValue label="Name" value={name} />
        <LabelledValue label="Telephone" value={telephone} />
        <LabelledValue label="Fax" value={fax} />
      </div>
    </div>
  )
}

function LabelledValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[13px] text-hz-text-secondary uppercase tracking-wider font-medium">{label}</div>
      <div className="text-[13px] text-hz-text mt-1">{value || '—'}</div>
    </div>
  )
}
