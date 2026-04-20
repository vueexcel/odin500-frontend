import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Moon, Sun } from 'lucide-react';
import odinLogo from '../assets/odin500-logo.svg';
import odinLogoLight from '../assets/odin500-logo-light.svg';
import { AuthHeroVisual, AuthShellThemeContext } from './AuthSplitShell.jsx';

/**
 * Split auth marketing layout (hero hidden on mobile). Use for forgot-password & signup substeps.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.backTo='/login']
 * @param {string} [props.backAriaLabel='Go back']
 */
export function AuthFlowShell({ children, backTo = '/login', backAriaLabel = 'Go back' }) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('odin_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('odin_theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const isDark = theme === 'dark';

  return (
    <AuthShellThemeContext.Provider value={theme}>
      <div
        className={`flex min-h-screen flex-col font-sans lg:min-h-screen lg:flex-row ${isDark ? 'bg-[#020617]' : 'bg-[#f8fafc]'}`}
      >
        <div
          className={`relative hidden shrink-0 flex-col px-4 pb-0 pt-4 sm:px-6 sm:pt-6 lg:flex lg:w-1/2 lg:max-w-[50vw] lg:justify-center lg:p-8 lg:pr-5 ${isDark ? 'lg:bg-[#051120]' : 'lg:bg-[#eef2f7]'}`}
        >
          <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
            <AuthHeroVisual />
          </div>
        </div>

        <div
          className={`relative flex min-h-screen flex-1 flex-col px-5 pb-10 pt-5 sm:px-6 md:px-10 lg:min-h-0 lg:justify-center lg:px-16 lg:pb-16 lg:pt-10 ${
            isDark ? 'bg-[#051120] text-white' : 'bg-[#f4f7fa] text-slate-900'
          }`}
        >
          <div className="auth-form-scope relative mx-auto w-full max-w-[400px] flex-1 lg:flex-none">
            <div className="relative mb-8 flex min-h-[44px] items-center justify-center">
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className={`absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl transition-colors ${
                  isDark ? 'text-white hover:bg-white/10' : 'text-[#1a202c] hover:bg-slate-200/80'
                }`}
                aria-label={backAriaLabel}
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
              </button>
              <img src={isDark ? odinLogo : odinLogoLight} alt="Odin 500" className="auth-split-logo h-8 w-auto select-none" />
              <button
                type="button"
                onClick={toggleTheme}
                className={`absolute right-0 top-1/2 flex h-10 w-[76px] -translate-y-1/2 items-center rounded-full p-1 transition-colors ${
                  isDark ? 'bg-slate-800/95 ring-1 ring-white/12' : 'bg-slate-200/95 ring-1 ring-slate-300/90'
                }`}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span
                  className={`absolute left-1 top-1 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 ${
                    isDark
                      ? 'translate-x-0 bg-slate-700 text-slate-100'
                      : 'translate-x-[36px] bg-white text-amber-500 shadow-md'
                  }`}
                >
                  {isDark ? <Moon className="h-4 w-4" strokeWidth={2.2} /> : <Sun className="h-4 w-4" strokeWidth={2.2} />}
                </span>
                <span
                  className={`pointer-events-none ml-auto flex h-8 w-8 items-center justify-center rounded-full ${
                    isDark ? 'text-amber-400/50' : 'text-slate-400/70'
                  }`}
                  aria-hidden
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </span>
              </button>
            </div>

            {children}
          </div>
        </div>
      </div>
    </AuthShellThemeContext.Provider>
  );
}
