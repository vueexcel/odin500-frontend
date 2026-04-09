/** Top line: arrow + bar; mirrors when collapsed to suggest “expand”. */
export function SidebarToggleGlyph({ expanded }) {
  const stroke = 'currentColor';
  const w = 1.75;
  if (expanded) {
    return (
      <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden>
        <path
          d="M7.5 3 L3.5 6 L7.5 9"
          stroke={stroke}
          strokeWidth={w}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M6.5 6 H18.5" stroke={stroke} strokeWidth={w} strokeLinecap="round" />
        <path d="M4 13 H18.5" stroke={stroke} strokeWidth={w} strokeLinecap="round" />
        <path d="M4 16.5 H18.5" stroke={stroke} strokeWidth={w} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden>
      <path
        d="M14.5 3 L18.5 6 L14.5 9"
        stroke={stroke}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.5 6 H3.5" stroke={stroke} strokeWidth={w} strokeLinecap="round" />
      <path d="M3.5 13 H18" stroke={stroke} strokeWidth={w} strokeLinecap="round" />
      <path d="M3.5 16.5 H18" stroke={stroke} strokeWidth={w} strokeLinecap="round" />
    </svg>
  );
}
