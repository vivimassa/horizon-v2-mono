/**
 * Renders a country flag as an image using flagcdn.com SVGs.
 * Windows does not render flag emoji, so we use images instead.
 */
export function CountryFlag({ iso2, size = 16, className }: { iso2: string; size?: number; className?: string }) {
  const code = iso2.toLowerCase()
  return (
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={iso2}
      width={size}
      height={Math.round(size * 0.75)}
      className={className}
      style={{
        display: 'inline-block',
        objectFit: 'cover',
        borderRadius: 2,
        verticalAlign: 'middle',
      }}
    />
  )
}
