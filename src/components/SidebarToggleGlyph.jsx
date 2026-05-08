/** Figma-matched panel toggle glyph. */
export function SidebarToggleGlyph({ expanded }) {
  const stroke = 'currentColor';
  const w = 1.5;
  if (expanded) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <rect x="2" y="2.25" width="14" height="13.5" rx="2.5" stroke={stroke} strokeWidth="1.35" />
        <path d="M6.65 4.8 V13.2" stroke={stroke} strokeWidth="1.35" strokeLinecap="round" />
        <path
          d="M11.2 6.2 L8.9 9 L11.2 11.8"
          stroke={stroke}
          strokeWidth={w}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2" y="2.25" width="14" height="13.5" rx="2.5" stroke={stroke} strokeWidth="1.35" />
      <path d="M11.35 4.8 V13.2" stroke={stroke} strokeWidth="1.35" strokeLinecap="round" />
      <path
        d="M6.8 6.2 L9.1 9 L6.8 11.8"
        stroke={stroke}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
