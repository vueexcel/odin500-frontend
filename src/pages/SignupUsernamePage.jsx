import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { AuthFlowShell } from '../components/AuthFlowShell.jsx';
import { AuthField, AuthShellThemeContext } from '../components/AuthSplitShell.jsx';
import { updateDisplayName } from '../services/authApi.js';
import { getAuthToken } from '../store/apiStore.js';
import { PENDING_DISPLAY_NAME_KEY, SIGNUP_EMAIL_KEY } from '../utils/signupSession.js';

function UsernameBody() {
  const navigate = useNavigate();
  const theme = useContext(AuthShellThemeContext);
  const isDark = theme === 'dark';

  const [displayName, setDisplayName] = useState('');
  const [marketing, setMarketing] = useState(true);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasToken, setHasToken] = useState(() => Boolean(getAuthToken()));

  useEffect(() => {
    const onAuth = () => setHasToken(Boolean(getAuthToken()));
    window.addEventListener('odin-auth-updated', onAuth);
    return () => window.removeEventListener('odin-auth-updated', onAuth);
  }, []);

  useEffect(() => {
    try {
      const em = sessionStorage.getItem(SIGNUP_EMAIL_KEY);
      if (!em) navigate('/signup', { replace: true });
    } catch {
      navigate('/signup', { replace: true });
    }
  }, [navigate]);

  const muted = isDark ? 'text-slate-400' : '';
  const mutedStyle = !isDark ? { color: '#718096' } : undefined;
  const titleCls = isDark ? 'text-white' : 'text-[#1a202c]';

  const primaryBtn =
    isDark
      ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] shadow-[0_0_26px_rgba(59,130,246,0.45)] hover:brightness-110'
      : 'bg-[#3b82f6] shadow-[0_10px_28px_-6px_rgba(59,130,246,0.45)] hover:brightness-[1.03]';

  const disabledBtn = isDark ? 'bg-slate-700/85 text-slate-400' : 'bg-[#8eaafb] text-[#5c6c85]';

  const formValid = useMemo(
    () => String(displayName || '').trim().length >= 2 && terms,
    [displayName, terms]
  );

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!formValid || busy) return;
      const name = displayName.trim();
      const token = getAuthToken();

      if (!token) {
        try {
          sessionStorage.setItem(PENDING_DISPLAY_NAME_KEY, name);
          sessionStorage.removeItem(SIGNUP_EMAIL_KEY);
        } catch {
          /* ignore */
        }
        navigate('/login', { replace: false });
        return;
      }

      setBusy(true);
      setError('');
      try {
        await updateDisplayName(name);
        try {
          sessionStorage.removeItem(SIGNUP_EMAIL_KEY);
        } catch {
          /* ignore */
        }
        navigate('/market', { replace: true });
      } catch (err) {
        setError(err.message || 'Could not save display name');
      } finally {
        setBusy(false);
      }
    },
    [displayName, formValid, busy, navigate]
  );

  const linkCls = isDark ? 'text-[#60a5fa] hover:text-[#93c5fd]' : 'text-[#2b73fe] hover:text-[#1d5ee0]';

  return (
    <form className="flex flex-col items-stretch pb-6" onSubmit={onSubmit} noValidate>
      {!hasToken ? (
        <div
          className={`mb-5 rounded-xl px-4 py-3 text-[13px] leading-snug ${
            isDark ? 'bg-sky-950/30 text-sky-100 ring-1 ring-sky-500/20' : 'bg-sky-50 text-slate-800 ring-1 ring-sky-200/90'
          }`}
        >
          After you tap Continue, you&apos;ll sign in once so we can save your display name to your account.
        </div>
      ) : null}

      <h1 className={`mb-2 text-center text-[1.45rem] font-extrabold tracking-tight sm:text-[1.65rem] ${titleCls}`}>
        Almost there
      </h1>
      <p className={`mb-6 text-center text-[14px] leading-relaxed ${muted}`} style={mutedStyle}>
        Finish creating your account
      </p>

      <div className="mb-2">
        <AuthField
          id="signupDisplayName"
          type="text"
          autoComplete="nickname"
          placeholder="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          icon={User}
          clearable
          onClear={() => setDisplayName('')}
        />
      </div>
      <p className={`mb-6 px-1 text-[12px] ${muted}`} style={mutedStyle}>
        You can change the public username twice
      </p>

      <label
        className={`mb-3 flex cursor-pointer items-start gap-3 text-[13px] font-medium ${
          isDark ? 'text-slate-200' : 'text-slate-800'
        }`}
      >
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 ${
            isDark ? 'border-slate-500 accent-[#3b82f6]' : 'border-slate-400 accent-[#2b73fe]'
          }`}
        />
        Receive marketing emails with special offers
      </label>

      <label
        className={`mb-6 flex cursor-pointer items-start gap-3 text-[13px] font-medium ${
          isDark ? 'text-slate-200' : 'text-slate-800'
        }`}
      >
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 ${
            isDark ? 'border-slate-500 accent-[#3b82f6]' : 'border-slate-400 accent-[#2b73fe]'
          }`}
        />
        <span>
          I have read and agreed with the{' '}
          <a href="#" className={`font-semibold ${linkCls}`} onClick={(e) => e.preventDefault()}>
            Terms of Use
          </a>{' '}
          and{' '}
          <a href="#" className={`font-semibold ${linkCls}`} onClick={(e) => e.preventDefault()}>
            Privacy Policy
          </a>
        </span>
      </label>

      <button
        type="submit"
        disabled={!formValid || busy}
        className={`w-full rounded-xl py-3.5 text-[15px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-100 ${
          !formValid || busy ? disabledBtn : `text-white ${primaryBtn}`
        }`}
      >
        {busy ? 'Saving…' : !hasToken ? 'Continue to sign in' : 'Continue'}
      </button>

      {error ? (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-center text-[13px] font-medium ${
            isDark ? 'bg-red-950/50 text-red-200 ring-1 ring-red-500/30' : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </form>
  );
}

export default function SignupUsernamePage() {
  return (
    <AuthFlowShell backTo="/signup/enter-code" backAriaLabel="Back">
      <UsernameBody />
    </AuthFlowShell>
  );
}
