import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Eye, EyeOff, Moon, Sun, X } from 'lucide-react';
import odinLogo from '../assets/odin500-logo.svg';
import odinLogoLight from '../assets/odin500-logo-light.svg';
import heroImage from '../assets/Hero.png';

export const AuthShellThemeContext = createContext('dark');

export function AuthHeroVisual() {
  return (
    <div
      className="auth-split-hero__viz relative min-h-[260px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#030b14] shadow-lg ring-1 ring-black/20 lg:h-[min(100vh-4rem,720px)] lg:min-h-[320px] lg:rounded-3xl lg:rounded-r-[2rem]"
      aria-hidden
    >
      <img
        src={heroImage}
        alt=""
        className="h-[260px] w-full object-cover object-center lg:absolute lg:inset-0 lg:h-full lg:min-h-full"
        decoding="async"
        fetchpriority="high"
      />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#4285F4"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#34A853"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}

function AppleMark({ className }) {
  return (
    <svg className={`h-[19px] w-[19px] shrink-0 ${className || ''}`} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.633 0 2.886.06 4.374 2.16-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
      />
    </svg>
  );
}

export function AuthSplitShell({ title = 'Welcome Back!', children }) {
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

  const tabClass = (isActive) => {
    if (isActive) {
      return isDark
        ? 'flex-1 rounded-full bg-[#3b82f6] py-2.5 text-center text-[13px] font-semibold text-white shadow-[0_0_22px_rgba(59,130,246,0.4)]'
        : 'flex-1 rounded-full bg-[#2b73fe] py-2.5 text-center text-[13px] font-semibold text-white shadow-[0_8px_22px_-4px_rgba(43,115,254,0.55)]';
    }
    return isDark
      ? 'flex-1 rounded-full py-2.5 text-center text-[13px] font-semibold text-slate-400 hover:text-slate-200'
      : 'flex-1 rounded-full py-2.5 text-center text-[13px] font-semibold text-slate-600 hover:text-slate-900';
  };

  return (
    <AuthShellThemeContext.Provider value={theme}>
      <div
        className={`flex min-h-screen flex-col font-sans lg:min-h-screen lg:flex-row ${isDark ? 'bg-[#020617]' : 'bg-[#eef2f7]'}`}
      >
        <div
          className={`relative flex shrink-0 flex-col px-4 pb-3 pt-4 sm:px-6 sm:pt-6 lg:w-1/2 lg:max-w-[50vw] lg:justify-center lg:p-8 lg:pr-5 ${isDark ? 'lg:bg-[#051120]' : 'lg:bg-[#eef2f7]'}`}
        >
          <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
            <AuthHeroVisual />
          </div>
        </div>

        <div
          className={`relative flex flex-1 flex-col px-5 pb-12 pt-6 sm:px-10 lg:justify-center lg:px-16 lg:pb-16 lg:pt-10 ${
            isDark ? 'bg-[#051120] text-white' : 'bg-[#f0f4f8] text-slate-900'
          }`}
        >
          <div className="auth-form-scope relative mx-auto w-full max-w-[400px] flex-1 lg:flex-none">
            <div className="relative mb-8 flex min-h-[40px] items-start justify-center pt-1">
              <img src={isDark ? odinLogo : odinLogoLight} alt="Odin 500" className="auth-split-logo h-8 w-auto select-none" />
              <button
                type="button"
                onClick={toggleTheme}
                className={`absolute right-0 top-0 flex h-10 w-[76px] items-center rounded-full p-1 transition-colors ${
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

            <h1
              className={`mb-6 text-center text-[1.65rem] font-extrabold tracking-tight sm:text-[1.85rem] ${
                isDark ? 'text-white' : 'text-[#0b1e36]'
              }`}
            >
              {title}
            </h1>

            <div
              className={`mb-8 flex rounded-full p-1 ${
                isDark ? 'bg-black/30 ring-1 ring-white/[0.07]' : 'bg-slate-200/90 ring-1 ring-slate-300/70'
              }`}
            >
              <NavLink to="/login" className={({ isActive }) => tabClass(isActive)}>
                Sign in
              </NavLink>
              <NavLink to="/signup" className={({ isActive }) => tabClass(isActive)}>
                Sign up
              </NavLink>
            </div>

            {children}

            <div className="my-8 flex items-center gap-3">
              <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-300/90'}`} />
              <span className={`text-[12px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>or</span>
              <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-300/90'}`} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-colors ${
                  isDark
                    ? 'bg-[#0f1f33] text-white ring-1 ring-white/10 hover:bg-slate-800/90'
                    : 'bg-[#e8ecf2] text-slate-800 ring-1 ring-slate-200/90 hover:bg-slate-200/95'
                }`}
              >
                <GoogleMark />
                Google
              </button>
              <button
                type="button"
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-colors ${
                  isDark
                    ? 'bg-[#0f1f33] text-white ring-1 ring-white/10 hover:bg-slate-800/90'
                    : 'bg-[#e8ecf2] text-slate-800 ring-1 ring-slate-200/90 hover:bg-slate-200/95'
                }`}
              >
                <FacebookMark />
                Facebook
              </button>
              <button
                type="button"
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-colors ${
                  isDark
                    ? 'bg-[#0f1f33] text-white ring-1 ring-white/10 hover:bg-slate-800/90'
                    : 'bg-[#e8ecf2] text-slate-800 ring-1 ring-slate-200/90 hover:bg-slate-200/95'
                }`}
              >
                <AppleMark className={isDark ? 'text-white' : 'text-slate-900'} />
                Apple
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthShellThemeContext.Provider>
  );
}

export function AuthField({
  id,
  type,
  autoComplete,
  placeholder,
  value,
  onChange,
  icon: Icon,
  showPasswordToggle,
  showPassword,
  onTogglePassword,
  invalid,
  clearable,
  onClear,
  inputClassName,
  /** Light-mode only: outer grey shell + dark inner field + blue eye (Figma forgot/reset). */
  appearance = 'default'
}) {
  const theme = useContext(AuthShellThemeContext);
  const isDark = theme === 'dark';

  const figmaNestedLight = appearance === 'figmaNestedLight' && !isDark && showPasswordToggle;

  if (figmaNestedLight) {
    const outerFocus = invalid
      ? 'ring-2 ring-[#e53e3e]'
      : 'ring-1 ring-slate-300/55 focus-within:ring-2 focus-within:ring-[#3b82f6]/35';

    return (
      <div
        className={`auth-figma-password-row flex min-h-[56px] w-full items-center gap-2 rounded-xl bg-[#e8ecf2] p-2 transition-[box-shadow] ${outerFocus}`}
      >
        <span className="flex w-10 shrink-0 items-center justify-center text-slate-500" aria-hidden>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div
          className={`auth-figma-password-inner flex min-h-[44px] min-w-0 flex-1 items-center overflow-hidden rounded-lg  px-3 transition-[box-shadow] ${
            invalid
              ? 'ring-2 ring-[#e53e3e]'
              : 'focus-within:shadow-[inset_0_-3px_0_0_#3b82f6]'
          }`}
        >
          <input
            id={id}
            type={showPassword ? 'text' : 'password'}
            autoComplete={autoComplete}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className={`auth-figma-pw-input min-h-[44px] w-full border-0 bg-transparent py-2 text-[14px] font-medium outline-none placeholder:font-normal ${inputClassName || ''} text-white placeholder:text-slate-400`}
          />
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            tabIndex={-1}
            onClick={onTogglePassword}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2b6cb0] text-[#121926] shadow-sm transition-colors hover:bg-[#2563ae]"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-[17px] w-[17px]" strokeWidth={2.2} /> : <Eye className="h-[17px] w-[17px]" strokeWidth={2.2} />}
          </button>
        </div>
      </div>
    );
  }

  const shellClass = invalid
    ? isDark
      ? 'border-[#e53e3e] bg-[#0f1f33] ring-2 ring-red-500/25'
      : 'border-[#e53e3e] bg-white ring-2 ring-red-500/20'
    : isDark
      ? 'border-white/[0.1] bg-[#0f1f33] ring-1 ring-white/[0.06] focus-within:border-[#3b82f6]/55 focus-within:ring-2 focus-within:ring-[#3b82f6]/22'
      : 'border-transparent bg-[#e8ecf2] ring-0 focus-within:border-[#2b73fe] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2b73fe]/22';

  const showClear = Boolean(clearable && String(value || '').length > 0 && onClear);

  return (
    <div
      className={`flex min-h-[52px] w-full items-stretch overflow-hidden rounded-xl border transition-[box-shadow,background-color] ${shellClass}`}
    >
      <span
        className={`flex w-12 shrink-0 items-center justify-center ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <input
        id={id}
        type={showPasswordToggle ? (showPassword ? 'text' : 'password') : type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`auth-shell-native min-h-[52px] min-w-0 flex-1 border-0 bg-transparent py-3 pr-3 text-[14px] font-medium outline-none placeholder:font-normal ${
          isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-500'
        } ${inputClassName || ''}`}
      />
      {showClear ? (
        <div className="flex shrink-0 items-center pr-2">
          <button
            type="button"
            tabIndex={-1}
            onClick={onClear}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-200/90 hover:text-slate-800'
            }`}
            aria-label="Clear"
          >
            <X className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </button>
        </div>
      ) : null}
      {showPasswordToggle ? (
        <div className="flex shrink-0 items-stretch py-2 pr-2 pl-1">
          <button
            type="button"
            tabIndex={-1}
            onClick={onTogglePassword}
            className={
              isDark
                ? 'flex w-10 items-center justify-center self-stretch rounded-lg bg-[#3b82f6] text-white shadow-sm transition-colors hover:bg-[#2563eb]'
                : 'flex w-10 items-center justify-center self-stretch rounded-lg bg-slate-200 text-slate-600 ring-1 ring-slate-300/80 transition-colors hover:bg-slate-300/90'
            }
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-[17px] w-[17px]" strokeWidth={2.2} /> : <Eye className="h-[17px] w-[17px]" strokeWidth={2.2} />}
          </button>
        </div>
      ) : null}
    </div>
  );
}
