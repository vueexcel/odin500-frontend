import { Link } from 'react-router-dom';

function IconReddit({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747 1.336.289a5.83 5.83 0 0 0-4.135 2.03 3.915 3.915 0 0 0-2.88-.402 3.918 3.918 0 0 0-2.855 1.523 1.25 1.25 0 0 0 .183 1.688 1.25 1.25 0 0 0 1.688.183A1.43 1.43 0 0 1 6 11.898c1.21 0 2.43.618 3.11 1.5.57.74.895 1.67.895 2.602a3.92 3.92 0 0 0-.654 2.147c-.46.299-1.098.5-1.84.5-.896 0-1.648-.421-2.004-1.176a.752.752 0 0 0-.422-.27 1.25 1.25 0 0 0-1.23 2.121c.609.992 1.494 1.826 2.58 2.431a4.112 4.112 0 0 0 1.748.502v.002a4.112 4.112 0 0 0 1.748-.502c1.086-.605 1.971-1.439 2.58-2.431a1.25 1.25 0 0 0-1.23-2.121.752.752 0 0 0-.422.27c-.356.755-1.108 1.176-2.004 1.176-.742 0-1.38-.201-1.84-.5a3.92 3.92 0 0 0-.654-2.147c0-.932.324-1.862.895-2.602.68-.882 1.9-1.5 3.11-1.5a1.43 1.43 0 0 1 1.406 1.256l1.336-.289.8-3.747-2.597.547a1.25 1.25 0 0 1-2.498-.056 1.25 1.25 0 0 1 1.25-1.249zM9.5 14.25a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0zm5 0a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0z" />
    </svg>
  );
}

function IconX({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconYouTube({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

const linkClass = 'site-footer__link transition-colors text-sm leading-relaxed block';

export function SiteFooter() {
  return (
    <footer className="site-footer w-full border-t">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          {/* Column 1 — Company & apps */}
          <div className="space-y-5">
            <p className="site-footer__muted text-xs">© 2026 ODIN. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <a
                href="https://reddit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#FF4500] shadow-sm transition hover:opacity-90"
                aria-label="Reddit"
              >
                <IconReddit className="h-5 w-5" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-sm transition hover:opacity-90"
                aria-label="X"
              >
                <IconX className="h-4 w-4" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#FF0000] shadow-sm transition hover:opacity-90"
                aria-label="YouTube"
              >
                <IconYouTube className="h-5 w-5" />
              </a>
            </div>
            <div className="space-y-2 text-sm">
              <p className="site-footer__label font-semibold">ODIN SaaS</p>
              <p className="site-footer__muted">Address: -----</p>
              <p className="site-footer__muted">
                Email:{' '}
                <a href="mailto:help@odin.com" className="site-footer__link">
                  help@odin.com
                </a>
              </p>
            </div>
            <div>
              <p className="site-footer__label mb-3 text-sm font-semibold">Get ODIN App:</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#"
                  className="inline-flex min-h-[44px] w-full min-w-0 items-center rounded-md bg-black px-3 py-2 text-left text-[10px] font-medium leading-tight text-white ring-1 ring-white/10 transition hover:bg-zinc-900 sm:min-w-[148px] sm:w-auto sm:text-[11px]"
                >
                  <svg className="mr-2 h-9 w-9 shrink-0" viewBox="0 0 24 24" aria-hidden>
                    <defs>
                      <linearGradient id="gpGrad" x1="0" y1="0" x2="24" y2="24">
                        <stop offset="0%" stopColor="#00D9FF" />
                        <stop offset="35%" stopColor="#00F076" />
                        <stop offset="70%" stopColor="#FFE500" />
                        <stop offset="100%" stopColor="#FF3A44" />
                      </linearGradient>
                    </defs>
                    <path fill="url(#gpGrad)" d="M3 3v18l18-9L3 3z" />
                  </svg>
                  <span>
                    GET IT ON
                    <br />
                    <span className="text-sm font-semibold">Google Play</span>
                  </span>
                </a>
                <a
                  href="#"
                  className="inline-flex min-h-[44px] w-full min-w-0 items-center rounded-md bg-black px-3 py-2 text-left text-[10px] font-medium leading-tight text-white ring-1 ring-white/10 transition hover:bg-zinc-900 sm:min-w-[148px] sm:w-auto sm:text-[11px]"
                >
                  <svg className="mr-2 h-8 w-8 shrink-0 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <span>
                    Download on the
                    <br />
                    <span className="text-sm font-semibold">App Store</span>
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* Column 2 — Product */}
          <div>
            <h3 className="site-footer__heading mb-4 text-sm font-bold tracking-wide">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/market" className={linkClass}>
                  Portfolio tracker
                </Link>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  Stock tracker
                </a>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  Divident tracker
                </a>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  Divident calendar
                </a>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  Pricing
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3 — Resources */}
          <div>
            <h3 className="site-footer__heading mb-4 text-sm font-bold tracking-wide">Resources</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className={linkClass}>
                  Terms and conditions
                </a>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  Privacy policy
                </a>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  Security
                </a>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  Yondlee
                </a>
              </li>
              <li>
                <Link to="/about" className={linkClass}>
                  About us
                </Link>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  Contacts
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4 — Support */}
          <div>
            <h3 className="site-footer__heading mb-4 text-sm font-bold tracking-wide">Support</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className={linkClass}>
                  Support
                </a>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  Knowledge Base
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
