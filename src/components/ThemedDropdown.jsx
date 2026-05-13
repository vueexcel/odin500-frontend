import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function ChevronDownIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" />
    </svg>
  );
}

/** z-index above charts, rails, and most modals so portaled menus stay visible */
const MENU_PORTAL_Z = 12000;

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
 *   menuMaxHeight?: string,
 *   className?: string,
 *   style?: import('react').CSSProperties,
 *   buttonId?: string,
 *   wideLabel?: boolean,
 *   menuMatchTriggerWidth?: boolean,
 *   disabled?: boolean,
 *   menuPortal?: boolean,
 * }} props
 * `menuPortal` defaults to true: menu is rendered in `document.body` with fixed position so it is not clipped by overflow-x ancestors (e.g. returns toolbars). Set false to keep the menu inside the trigger (legacy).
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
  menuMaxHeight,
  className = '',
  style,
  buttonId,
  wideLabel = false,
  menuMatchTriggerWidth = true,
  disabled = false,
  menuPortal = true
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(/** @type {HTMLUListElement | null} */ (null));
  const [menuPos, setMenuPos] = useState(
    /** @type {{ top: number, left: number, width: number, maxHeight: string } | null} */ (null)
  );

  const syncMenuPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const top = r.bottom + gap;
    let left = r.left;
    const minMenu = size === 'sm' ? 92 : 132;
    const width = menuMatchTriggerWidth ? Math.max(r.width, minMenu) : Math.max(r.width, minMenu);
    left = Math.min(left, vw - width - 8);
    left = Math.max(8, left);
    const spaceBelow = vh - top - 10;
    const defaultCap = 300;
    const cap = menuMaxHeight ? defaultCap : Math.min(defaultCap, Math.max(140, spaceBelow));
    const maxHeight = menuMaxHeight || `${cap}px`;
    setMenuPos({ top, left, width, maxHeight });
  }, [size, menuMatchTriggerWidth, menuMaxHeight]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open || !menuPortal) {
      setMenuPos(null);
      return;
    }
    syncMenuPosition();
    window.addEventListener('scroll', syncMenuPosition, true);
    window.addEventListener('resize', syncMenuPosition);
    return () => {
      window.removeEventListener('scroll', syncMenuPosition, true);
      window.removeEventListener('resize', syncMenuPosition);
    };
  }, [open, menuPortal, syncMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event) => {
      const t = /** @type {Node} */ (event.target);
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
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

  const rootClass =
    'app-dropdown' +
    (size === 'sm' ? ' app-dropdown--sm' : '') +
    (wideLabel ? ' app-dropdown--wide-label' : '') +
    (menuMatchTriggerWidth ? ' app-dropdown--menu-match' : '') +
    (className ? ' ' + className.trim() : '');

  const menuListClass =
    'app-dropdown__menu' +
    (menuMaxHeight ? ' app-dropdown__menu--scrollable' : '') +
    (menuPortal ? ' app-dropdown__menu--portal' : '');

  const menuEl = open ? (
    <ul
      ref={menuRef}
      className={menuListClass}
      role="menu"
      style={
        menuPortal && menuPos
          ? {
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              minWidth: menuPos.width,
              maxHeight: menuPos.maxHeight,
              zIndex: MENU_PORTAL_Z,
              margin: 0
            }
          : menuMaxHeight
            ? { maxHeight: menuMaxHeight }
            : undefined
      }
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
  ) : null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <div className={rootClass} style={style} ref={wrapRef}>
      <button
        type="button"
        id={buttonId}
        className="app-dropdown__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${ariaLabelPrefix}: ${currentLabel}`}
        title={title}
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        {icon ? <span className="app-dropdown__icon">{icon}</span> : null}
        <span className="app-dropdown__label">{currentLabel}</span>
        <ChevronDownIcon className="app-dropdown__chev" />
      </button>
      {menuPortal && menuEl && portalTarget
        ? createPortal(menuEl, portalTarget)
        : !menuPortal && menuEl}
    </div>
  );
}
