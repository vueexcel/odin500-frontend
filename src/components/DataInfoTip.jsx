import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Light “i in circle” for dark UI (matches reference info icon). */
function IconInfoCircle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <circle cx="12" cy="12" r="9.25" />
      <path strokeLinecap="round" d="M12 16v-5.5M12 8h.01" />
    </svg>
  );
}

/** Info button + floating tooltip (ticker cards, annual charts, etc.). */
export function DataInfoTip({ align = 'end', children }) {
  const [open, setOpen] = useState(false);
  const [flipH, setFlipH] = useState(false);
  const wrapRef = useRef(null);
  const floatRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) {
      setFlipH(false);
      return;
    }
    const pad = 12;
    function measure() {
      const el = floatRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      if (align === 'start') {
        setFlipH(r.right > vw - pad);
      } else {
        setFlipH(r.left < pad);
      }
    }
    const id = requestAnimationFrame(() => measure());
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', measure);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span
      ref={wrapRef}
      className={
        'ticker-data-tip ticker-data-tip--align-' + align + (flipH ? ' ticker-data-tip--flip-h' : '')
      }
    >
      <button
        type="button"
        className="ticker-data-tip__btn"
        aria-expanded={open}
        aria-label="What data is this?"
        onClick={() => setOpen((v) => !v)}
      >
        <IconInfoCircle className="ticker-data-tip__ico" />
      </button>
      {open ? (
        <div ref={floatRef} className="ticker-data-tip__float" role="tooltip">
          <div className="ticker-data-tip__inner">{children}</div>
        </div>
      ) : null}
    </span>
  );
}
