/**
 * Enter / exit fullscreen icons (matches IndexPage ticker chart footer).
 * @param {{ isFullscreen?: boolean }} props
 */
export function ChartFullscreenToggleIcon({ isFullscreen = false }) {
  if (isFullscreen) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M4 14v6h6M20 14v6h-6M4 10V4h6M20 10V4h-6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6" />
    </svg>
  );
}
