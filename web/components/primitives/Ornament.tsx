export function Ornament({ w = 80, color = "var(--gold-deep)" }: { w?: number; color?: string }) {
  return (
    <svg width={w} height="14" viewBox="0 0 80 14" style={{ display: "block" }}>
      <path d="M0 7 L26 7" stroke={color} strokeWidth="1.2" />
      <circle cx="32" cy="7" r="2" fill={color} />
      <path d="M36 7 Q40 1, 44 7 T52 7" stroke={color} strokeWidth="1.2" fill="none" />
      <circle cx="56" cy="7" r="2" fill={color} />
      <path d="M62 7 L80 7" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
