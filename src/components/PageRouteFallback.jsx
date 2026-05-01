/** Lightweight route transition shell — keep imports minimal so this chunk stays tiny. */
export function PageRouteFallback() {
  return (
    <div
      className="route-page-fallback"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="route-page-fallback__inner">
        <span className="route-page-fallback__spinner" aria-hidden />
        <span className="route-page-fallback__text">Loading…</span>
      </div>
    </div>
  );
}
