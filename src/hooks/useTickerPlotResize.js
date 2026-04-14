import { useCallback, useRef, useState } from 'react';

const DEFAULT_MIN = 160;
const DEFAULT_MAX = 900;

function readStoredHeight(storageKey, lo, hi) {
  try {
    const raw = localStorage.getItem(storageKey);
    const n = raw != null ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= lo && n <= hi) return n;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Persisted vertical plot size for ticker SVG blocks.
 * @param {string | null | undefined} storageKey — omit or null to disable (no rail, `plotHeight` stays null).
 * @param {number} defaultHeight
 * @param {number} [min]
 * @param {number} [max]
 */
export function useTickerPlotResize(storageKey, defaultHeight, min, max) {
  const enabled = typeof storageKey === 'string' && storageKey.length > 0;
  const minV = min ?? DEFAULT_MIN;
  const maxV = max ?? DEFAULT_MAX;
  const lo = Math.max(80, minV);
  const hi = Math.max(lo + 20, maxV);
  const def = Number.isFinite(defaultHeight) ? Math.min(hi, Math.max(lo, Math.round(defaultHeight))) : 280;

  const [userH, setUserH] = useState(() =>
    enabled && storageKey ? readStoredHeight(storageKey, lo, hi) : null
  );
  const defRef = useRef(def);
  defRef.current = def;
  const resizeDragRef = useRef(/** @type {{ active: boolean, startY: number, startH: number } | null} */ (null));

  const effective = !enabled ? null : userH == null ? def : Math.min(hi, Math.max(lo, userH));

  const onPointerDown = useCallback(
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      const startH = userH ?? defRef.current;
      resizeDragRef.current = { active: true, startY: e.clientY, startH };
      const onMove = (ev) => {
        const drag = resizeDragRef.current;
        if (!drag?.active) return;
        const dy = ev.clientY - drag.startY;
        const next = Math.round(Math.min(hi, Math.max(lo, drag.startH + dy)));
        setUserH(next);
      };
      const onUp = () => {
        if (resizeDragRef.current) resizeDragRef.current.active = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setUserH((prev) => {
          const v = prev == null ? defRef.current : prev;
          try {
            localStorage.setItem(storageKey, String(v));
          } catch {
            /* ignore */
          }
          return prev;
        });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [enabled, userH, hi, lo, storageKey]
  );

  const onDoubleClick = useCallback(
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      setUserH(null);
    },
    [enabled, storageKey]
  );

  return {
    enabled,
    /** Pixel height for charts when enabled; otherwise null */
    plotHeight: effective,
    onPointerDown,
    onDoubleClick,
    ariaMin: lo,
    ariaMax: hi,
    ariaNow: effective ?? def
  };
}
