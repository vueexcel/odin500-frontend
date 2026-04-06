import { useState, useRef, useEffect, useCallback } from 'react';
import { SIGNAL_GROUPS, msColor } from '../constants/signals.js';

function orderSelected(selectedSet) {
  const ordered = [];
  SIGNAL_GROUPS.forEach((g) => {
    g.signals.forEach((s) => {
      if (selectedSet.has(s)) ordered.push(s);
    });
  });
  const neutralKeys = ['N', 'N1', 'N2'];
  const neutralPick = neutralKeys.filter((s) => selectedSet.has(s));
  const rest = ordered.filter((s) => !neutralKeys.includes(s));
  return [...neutralPick, ...rest];
}

export function MultiSignalSelect({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selectedSet = new Set(value || []);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const toggle = useCallback(
    (sig, checked) => {
      const next = new Set(value || []);
      if (checked) next.add(sig);
      else next.delete(sig);
      onChange(orderSelected(next));
    },
    [value, onChange]
  );

  const remove = useCallback(
    (sig) => {
      const next = new Set(value || []);
      next.delete(sig);
      onChange(orderSelected(next));
    },
    [value, onChange]
  );

  const ordered = orderSelected(selectedSet);

  return (
    <div className="field">
      <label>{label}</label>
      <div className="ms-wrap" ref={wrapRef}>
        <div
          className="ms-box"
          tabIndex={0}
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen((o) => !o);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          {ordered.length === 0 ? (
            <span className="ms-placeholder">Select signals…</span>
          ) : (
            ordered.map((sig) => (
              <span key={sig} className="ms-tag" style={{ background: msColor(sig) }}>
                {sig}
                <button
                  type="button"
                  className="ms-tag-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(sig);
                  }}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className={'ms-dropdown' + (open ? '' : ' hidden')}>
          {SIGNAL_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="ms-group-label">{group.label}</div>
              {group.signals.map((sig) => (
                <label key={sig} className="ms-option">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(sig)}
                    onChange={(e) => toggle(sig, e.target.checked)}
                  />
                  <span className="ms-dot" style={{ background: msColor(sig) }} />
                  <span className="ms-option-label">{sig}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
