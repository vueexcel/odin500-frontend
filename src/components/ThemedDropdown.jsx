import { useEffect, useMemo, useRef, useState } from 'react';

function ChevronDownIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Shared menu-style dropdown for dark/light themes.
 * @param {{
 *   value: string,
 *   options: Array<{ id: string, label: string }>,
 *   onChange: (next: string) => void,
 *   icon?: import('react').ReactNode,
 *   title?: string,
 *   ariaLabelPrefix?: string,
 *   labelFallback?: string,
 *   size?: 'md' | 'sm',
 *   menuMaxHeight?: string
 * }} props
 */
export function ThemedDropdown({
  value,
  options,
  onChange,
  icon = null,
  title = 'Select',
  ariaLabelPrefix = 'Selected',
  labelFallback = 'Select',
  size = 'md',
  menuMaxHeight
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onDocKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
    };
  }, [open]);

  const currentLabel = useMemo(
    () => options.find((opt) => opt.id === value)?.label ?? labelFallback,
    [options, value, labelFallback]
  );

  return (
    <div className={'app-dropdown' + (size === 'sm' ? ' app-dropdown--sm' : '')} ref={wrapRef}>
      <button
        type="button"
        className="app-dropdown__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${ariaLabelPrefix}: ${currentLabel}`}
        title={title}
        onClick={() => setOpen((prev) => !prev)}
      >
        {icon ? <span className="app-dropdown__icon">{icon}</span> : null}
        <span className="app-dropdown__label">{currentLabel}</span>
        <ChevronDownIcon className="app-dropdown__chev" />
      </button>
      {open ? (
        <ul
          className={'app-dropdown__menu' + (menuMaxHeight ? ' app-dropdown__menu--scrollable' : '')}
          role="menu"
          style={menuMaxHeight ? { maxHeight: menuMaxHeight } : undefined}
        >
          {options.map((opt) => (
            <li key={opt.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={value === opt.id}
                className={'app-dropdown__item' + (value === opt.id ? ' app-dropdown__item--active' : '')}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
