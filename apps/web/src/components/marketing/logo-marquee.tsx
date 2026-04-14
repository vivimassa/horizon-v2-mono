'use client'

const LOGOS = [
  'VietJet Air',
  'Bamboo Airways',
  'Pacific Airlines',
  'VASCO',
  'Jetstar Pacific',
  'Star Aero',
  'Sky Global',
  'NorthWind',
]

export function LogoMarquee() {
  const doubled = [...LOGOS, ...LOGOS]
  return (
    <div
      className="relative overflow-hidden py-2"
      style={{
        maskImage: 'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)',
      }}
    >
      <div className="mkt-marquee-track gap-14">
        {doubled.map((name, i) => (
          <div
            key={`${name}-${i}`}
            className="shrink-0 text-[18px] md:text-[22px] font-bold tracking-tight opacity-40 whitespace-nowrap"
            style={{
              color: 'var(--mkt-text-dim)',
              fontVariant: 'small-caps',
              letterSpacing: '0.02em',
            }}
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  )
}
