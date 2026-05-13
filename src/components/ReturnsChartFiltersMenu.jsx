import { useEffect, useId, useRef, useState } from 'react';

function isInsidePortaledThemedDropdownMenu(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest('.app-dropdown__menu--portal'));
}

/**
 * Single “Filters” trigger that reveals chart toolbar actions in a dropdown (mobile / narrow layout).
 * @param {{ children: import('react').ReactNode, className?: string }} props
 */
export function ReturnsChartFiltersMenu({ children, className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const panelId = useId().replace(/:/g, '');

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const t = /** @type {Node | null} */ (e.target);
      if (rootRef.current && t && rootRef.current.contains(t)) return;
      if (isInsidePortaledThemedDropdownMenu(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={rootRef} className={'returns-chart-filters-menu ' + (className || '').trim()}>
      <button
        type="button"
        className="ticker-annual-figma__btn ticker-annual-figma__btn--outline returns-chart-filters-menu__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        Filters
      </button>
      {open ? (
        <div id={panelId} className="returns-chart-filters-menu__panel" role="menu" aria-label="Chart filters and actions">
          <div className="returns-chart-filters-menu__panel-inner">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
