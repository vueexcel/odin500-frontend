import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Light “i in circle” for dark UI (matches reference info icon). */
function IconInfoCircle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <circle cx="12" cy="12" r="9.25" />
      <path strokeLinecap="round" d="M12 16v-5.5M12 8h.01" />
    </svg>
  );
}

function positionTooltip(btnEl, floatEl, align) {
  if (!btnEl || !floatEl) return;
  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const br = btnEl.getBoundingClientRect();
  const fw = floatEl.offsetWidth;
  const fh = floatEl.offsetHeight;

  let top = br.bottom + 8;
  let left = align === 'end' ? br.right - fw : br.left;

  if (left < pad) left = pad;
  if (left + fw > vw - pad) left = Math.max(pad, vw - pad - fw);

  if (top + fh > vh - pad) {
    top = br.top - fh - 8;
  }
  if (top < pad) top = pad;

  Object.assign(floatEl.style, {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    right: 'auto',
    bottom: 'auto',
    zIndex: '10050'
  });
}

/** Info button + floating tooltip (portaled to `document.body`, clamped to viewport). */
export function DataInfoTip({ align = 'end', children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const portalRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return;
    const float = portalRef.current;
    const btn = btnRef.current;
    if (!float || !btn) return;

    function place() {
      positionTooltip(btn, float, align);
    }

    place();
    const id0 = requestAnimationFrame(place);
    const id1 = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(id0);
      cancelAnimationFrame(id1);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, children]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      const inWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const inPortal = portalRef.current && portalRef.current.contains(e.target);
      if (!inWrap && !inPortal) setOpen(false);
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
    <>
      <span ref={wrapRef} className="ticker-data-tip">
        <button
          ref={btnRef}
          type="button"
          className="ticker-data-tip__btn"
          aria-expanded={open}
          aria-label="What data is this?"
          onClick={() => setOpen((v) => !v)}
        >
          <IconInfoCircle className="ticker-data-tip__ico" />
        </button>
      </span>
      {open
        ? createPortal(
            <div ref={portalRef} className="ticker-data-tip__float ticker-data-tip__float--portal" role="tooltip">
              <div className="ticker-data-tip__inner">{children}</div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
