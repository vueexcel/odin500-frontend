import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { AuthForgotShell } from '../components/AuthForgotShell.jsx';
import { OtpSixBoxes } from '../components/OtpSixBoxes.jsx';
import { AuthField, AuthShellThemeContext } from '../components/AuthSplitShell.jsx';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowserClient.js';
import { startForgotPassword } from '../services/authApi.js';

const TEXT_MUTED_LIGHT = '#718096';

function passwordMeetsRules(pw) {
  const s = String(pw || '');
  if (s.length < 8) return false;
  let kinds = 0;
  if (/[A-Z]/.test(s)) kinds += 1;
  if (/[a-z]/.test(s)) kinds += 1;
  if (/[0-9]/.test(s)) kinds += 1;
  if (/[^A-Za-z0-9]/.test(s)) kinds += 1;
  return kinds >= 3;
}

/** Remove Supabase tokens from the address bar (hash / ?code= / errors) after the client has read them. */
function stripAuthFromUrl() {
  try {
    const path = window.location.pathname;
    window.history.replaceState(null, '', path);
  } catch {
    /* ignore */
  }
}

function ForgotPasswordFlow() {
  const navigate = useNavigate();
  const theme = useContext(AuthShellThemeContext);
  const isDark = theme === 'dark';

  const [booting, setBooting] = useState(true);
  /** checking | email | await_link | reset | success */
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** User arrived via the email link (or PKCE redirect) — no 6-digit code needed. */
  const [recoverySession, setRecoverySession] = useState(false);

  const unsubRef = useRef(null);

  const titleColor = isDark ? 'text-white' : 'text-[#1a2b48]';
  const mutedColor = isDark ? 'text-slate-400' : '';
  const mutedStyle = !isDark ? { color: TEXT_MUTED_LIGHT } : undefined;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

  const mismatch =
    String(newPassword).length > 0 &&
    String(confirmPassword).length > 0 &&
    newPassword !== confirmPassword;

  const rulesOk = passwordMeetsRules(newPassword);
  const otpOk = otp.length === 6;
  const canReset =
    rulesOk &&
    String(newPassword).length > 0 &&
    newPassword === confirmPassword &&
    (recoverySession ? true : otpOk);

  const primaryBtn =
    isDark
      ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] shadow-[0_0_26px_rgba(59,130,246,0.45),0_10px_28px_-8px_rgba(37,99,235,0.55)] hover:brightness-110'
      : 'bg-[#3b82f6] shadow-[0_10px_28px_-6px_rgba(59,130,246,0.5)] hover:brightness-[1.03]';

  const disabledBtn =
    isDark ? 'bg-slate-700/85 text-slate-400 shadow-none' : 'bg-[#8eaafb] text-[#5c6c85] shadow-none';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sb = await getSupabaseBrowserClient();
        if (cancelled) return;

        const params = new URLSearchParams(window.location.search);
        const hashStr = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
        const hashParams = new URLSearchParams(hashStr);
        const errRaw =
          params.get('error_description') ||
          params.get('error') ||
          hashParams.get('error_description') ||
          hashParams.get('error');
        if (errRaw) {
          setError(decodeURIComponent(String(errRaw).replace(/\+/g, ' ')));
        }

        if (params.get('code')) {
          const { error: exErr } = await sb.auth.exchangeCodeForSession(window.location.href);
          if (exErr) setError(exErr.message);
          stripAuthFromUrl();
        }

        const fromRecoveryHash =
          window.location.hash.includes('type=recovery') || window.location.hash.includes('type%3Drecovery');

        const { data: sessData } = await sb.auth.getSession();
        const session = sessData?.session;
        if (session && fromRecoveryHash) {
          setRecoverySession(true);
          setStep('reset');
          if (session.user?.email) setEmail(session.user.email);
          stripAuthFromUrl();
        }

        const {
          data: { subscription }
        } = sb.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          if (event === 'PASSWORD_RECOVERY' && session) {
            setRecoverySession(true);
            setStep('reset');
            if (session.user?.email) setEmail(session.user.email);
            stripAuthFromUrl();
          }
        });
        unsubRef.current = subscription;
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not initialize password reset');
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        unsubRef.current?.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const sendCode = async (e) => {
    e.preventDefault();
    if (!emailOk) return;
    setError('');
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/forgot-password`;
      await startForgotPassword(String(email || '').trim(), redirectTo);
      setStep('await_link');
    } catch (e2) {
      setError(e2.message || 'No account found for this email');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!canReset || mismatch) return;
    setBusy(true);
    setError('');
    try {
      const sb = await getSupabaseBrowserClient();

      if (!recoverySession) {
        const em = String(email || '').trim();
        if (!otpOk) {
          throw new Error('Enter the 6-digit code from your email, or open the reset link in this browser.');
        }
        const { error: vErr } = await sb.auth.verifyOtp({
          email: em,
          token: String(otp || '').trim(),
          type: 'recovery'
        });
        if (vErr) throw vErr;
      }

      const { error: uErr } = await sb.auth.updateUser({ password: newPassword });
      if (uErr) throw uErr;

      await sb.auth.signOut();
      stripAuthFromUrl();
      setStep('success');
    } catch (e2) {
      setError(e2.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  if (booting) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className={`text-[14px] ${mutedColor}`} style={mutedStyle}>
          Loading…
        </p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center text-center">
        <h1 className={`mb-3 text-[1.45rem] font-extrabold leading-snug tracking-tight sm:text-[1.65rem] ${titleColor}`}>
          Your password has been successfully changed!
        </h1>
        <p
          className={`mb-10 max-w-[340px] text-[14px] leading-relaxed ${mutedColor}`}
          style={!isDark ? { color: TEXT_MUTED_LIGHT } : undefined}
        >
          Keep it up! Remember: the longer and more random your password, the better!
        </p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className={`w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all ${primaryBtn}`}
        >
          Sign in
        </button>
      </div>
    );
  }

  if (step === 'await_link') {
    return (
      <div className="grid gap-5">
        <div>
          <h1 className={`mb-2 text-center text-[1.45rem] font-extrabold tracking-tight sm:text-[1.65rem] ${titleColor}`}>
            Check your email
          </h1>
          <p className={`text-center text-[14px] leading-relaxed ${mutedColor}`} style={mutedStyle}>
            We sent a <strong className="font-semibold">password reset link</strong> to{' '}
            <span className="font-semibold">{String(email || '').trim()}</span>. Open it on <strong>this device</strong> in
            the same browser — it returns you here to set a new password.
          </p>
          <p className={`mt-3 text-center text-[13px] leading-relaxed ${mutedColor}`} style={mutedStyle}>
            Supabase sends a <strong>link</strong>, not a text OTP, unless your project email template includes a code. If
            your email shows a 6-digit code, use “Continue with code” below.
          </p>
        </div>

        {error ? (
          <p className="px-1 text-center text-[12px] font-medium" style={{ color: '#e53e3e' }}>
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setError('');
              setBusy(true);
              try {
                await startForgotPassword(String(email || '').trim(), `${window.location.origin}/forgot-password`);
              } catch (e2) {
                setError(e2.message || 'Could not resend');
              } finally {
                setBusy(false);
              }
            }}
            className={`w-full rounded-xl py-3.5 text-[15px] font-bold transition-all ${busy ? disabledBtn : `text-white ${primaryBtn}`}`}
          >
            {busy ? 'Sending…' : 'Resend link'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('reset');
              setRecoverySession(false);
              setError('');
            }}
            className={`w-full rounded-xl border py-3.5 text-[15px] font-bold transition-all ${
              isDark
                ? 'border-white/20 text-slate-100 hover:bg-white/5'
                : 'border-slate-300 text-[#1a2b48] hover:bg-slate-50'
            }`}
          >
            Continue with code
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setStep('email');
            setError('');
          }}
          className={`text-center text-[13px] font-semibold underline-offset-2 hover:underline ${mutedColor}`}
        >
          Use a different email
        </button>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <form className="grid gap-5" onSubmit={resetPassword} noValidate>
        <div>
          <h1 className={`mb-2 text-center text-[1.45rem] font-extrabold tracking-tight sm:text-[1.65rem] ${titleColor}`}>
            Reset password
          </h1>
          <p className={`text-center text-[14px] leading-relaxed ${mutedColor}`} style={mutedStyle}>
            {recoverySession
              ? 'Choose a new password for your account.'
              : 'Enter the 6-digit code from your email (if your template includes one), then choose a new password.'}
          </p>
        </div>

        {!recoverySession ? (
          <div className="grid gap-2">
            <span className={`text-[13px] font-semibold ${isDark ? 'text-slate-200' : 'text-[#1a202c]'}`}>
              Verification code
            </span>
            <OtpSixBoxes value={otp} onChange={setOtp} disabled={busy} />
          </div>
        ) : null}

        <div className="grid gap-3">
          <AuthField
            id="fpNewPw"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            icon={KeyRound}
            appearance={isDark ? 'default' : 'figmaNestedLight'}
            showPasswordToggle
            showPassword={showNew}
            onTogglePassword={() => setShowNew((v) => !v)}
          />
          <div>
            <AuthField
              id="fpConfirmPw"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={KeyRound}
              appearance={isDark ? 'default' : 'figmaNestedLight'}
              invalid={mismatch}
              showPasswordToggle
              showPassword={showConfirm}
              onTogglePassword={() => setShowConfirm((v) => !v)}
            />
            {mismatch ? (
              <p className="mt-1.5 px-1 text-[12px] font-medium" style={{ color: '#e53e3e' }}>
                Passwords do not match.
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="px-1 text-center text-[12px] font-medium" style={{ color: '#e53e3e' }}>
            {error}
          </p>
        ) : null}

        <div
          className={`rounded-xl px-4 py-3 text-[13px] leading-snug ${
            isDark ? 'bg-[#0c1829] text-slate-300 ring-1 ring-white/[0.08]' : 'bg-[#e8eef5] text-[#1a2b48] ring-1 ring-slate-200/90'
          }`}
        >
          <p className={`font-bold ${isDark ? 'text-slate-100' : 'text-[#1a2b48]'}`}>Strong password required.</p>
          <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-[#475569]'}`}>
            Combine at least three of the following: uppercase letters, lowercase letters, numbers, and symbols.
          </p>
        </div>

        <button
          type="submit"
          disabled={busy || !canReset || mismatch}
          className={`mt-1 w-full rounded-xl py-3.5 text-[15px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-100 ${
            busy || !canReset || mismatch ? disabledBtn : `text-white ${primaryBtn}`
          }`}
        >
          {busy ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    );
  }

  return (
    <form className="grid gap-5" onSubmit={sendCode} noValidate>
      <div>
        <h1 className={`mb-2 text-center text-[1.45rem] font-extrabold tracking-tight sm:text-[1.65rem] ${titleColor}`}>
          Forgot your password
        </h1>
        <p className={`text-center text-[14px] leading-relaxed ${mutedColor}`} style={mutedStyle}>
          Enter the email for your account. We&apos;ll send a <strong className="font-semibold">reset link</strong> (and
          open it in this browser to continue — Supabase does not send a text OTP by default).
        </p>
      </div>

      <AuthField
        id="fpEmail"
        type="email"
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        icon={Mail}
        clearable
        onClear={() => setEmail('')}
      />
      {error ? (
        <p className="mt-[-8px] px-1 text-[12px] font-medium" style={{ color: '#e53e3e' }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !emailOk}
        className={`mt-1 w-full rounded-xl py-3.5 text-[15px] font-bold transition-all disabled:cursor-not-allowed ${
          busy || !emailOk ? disabledBtn : `text-white ${primaryBtn}`
        }`}
      >
        {busy ? 'Sending...' : 'Send reset link'}
      </button>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthForgotShell>
      <ForgotPasswordFlow />
    </AuthForgotShell>
  );
}
