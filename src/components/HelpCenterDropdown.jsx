import { useCallback, useEffect, useRef, useState } from 'react';

const HC_TRIGGER_ID = 'help-center-dd-trigger';
const HC_MENU_ID = 'help-center-dd-menu';

function IconQuestionMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="help-center-dd__qm-svg">
      <path d="M12 17.5h.01" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M9.2 9.2c0-1.65 1.35-3 3.05-3 1.68 0 2.95 1.25 2.95 2.85 0 1.45-.85 2.2-1.55 2.75-.55.42-.95.85-.95 1.65"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFooterQm() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="help-center-dd__footer-qm-ico">
      <path d="M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M9.2 9.2c0-1.65 1.35-3 3.05-3 1.68 0 2.95 1.25 2.95 2.85 0 1.45-.85 2.2-1.55 2.75-.55.42-.95.85-.95 1.65"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="help-center-dd__chev-svg">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2v6h6M10 13h4M10 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12a8 8 0 0 1-8 8H8l-5 3v-3a8 8 0 1 1 18-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 10l4-2v8l-4-2v-4z" fill="currentColor" />
    </svg>
  );
}

function IconBug() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="13" rx="7" ry="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 8V6M15 8V6M7 11H5M19 11h-2M9 19l-1 3M15 19l1 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const MENU_ITEMS = [
  {
    key: 'docs',
    title: 'Documentation',
    subtitle: 'Guides, references & tutorials',
    icoClass: 'help-center-dd__item-ico--doc',
    Icon: IconDoc
  },
  {
    key: 'chat',
    title: 'Live Chat',
    subtitle: 'Talk to a human now',
    icoClass: 'help-center-dd__item-ico--chat',
    Icon: IconChat
  },
  {
    key: 'video',
    title: 'Video Tutorials',
    subtitle: 'Step-by-step walkthroughs',
    icoClass: 'help-center-dd__item-ico--video',
    Icon: IconVideo
  },
  {
    key: 'bug',
    title: 'Report a Bug',
    subtitle: 'Something not working right?',
    icoClass: 'help-center-dd__item-ico--bug',
    Icon: IconBug
  }
];

export function HelpCenterDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (!rootRef.current?.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <div className={'help-center-dd' + (open ? ' help-center-dd--open' : '')} ref={rootRef}>
      <button
        type="button"
        className={'help-center-dd__trigger' + (open ? ' is-open' : '')}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={HC_MENU_ID}
        id={HC_TRIGGER_ID}
        onClick={toggle}
      >
        <span className="help-center-dd__icon-pulse" aria-hidden>
          <span className="help-center-dd__icon-gradient">
            <IconQuestionMark />
          </span>
        </span>
        <span className="help-center-dd__label">About Us</span>
        <span className="help-center-dd__chev" aria-hidden>
          <IconChevronDown />
        </span>
      </button>

      <div
        id={HC_MENU_ID}
        role="menu"
        aria-labelledby={HC_TRIGGER_ID}
        aria-hidden={!open}
        className={'help-center-dd__panel' + (open ? ' help-center-dd__panel--visible' : '')}
      >
        <div className="help-center-dd__header-label">How can we help?</div>
        <div className="help-center-dd__items" role="none">
          {MENU_ITEMS.map(({ key, title, subtitle, icoClass, Icon }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              className="help-center-dd__item"
              onClick={close}
            >
              <span className={'help-center-dd__item-ico ' + icoClass} aria-hidden>
                <Icon />
              </span>
              <span className="help-center-dd__item-text">
                <span className="help-center-dd__item-title">{title}</span>
                <span className="help-center-dd__item-sub">{subtitle}</span>
              </span>
              <span className="help-center-dd__item-arrow" aria-hidden>
                <IconArrowRight />
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="help-center-dd__footer-cta" onClick={close}>
          <IconFooterQm />
          <span>Browse all articles →</span>
        </button>
      </div>
    </div>
  );
}
