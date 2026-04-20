import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthFlowShell } from '../components/AuthFlowShell.jsx';
import { OtpSixBoxes } from '../components/OtpSixBoxes.jsx';
import { AuthShellThemeContext } from '../components/AuthSplitShell.jsx';
import { resendSignupOtp, verifySignupOtp } from '../services/authApi.js';
import { applyAuthSession } from '../store/apiStore.js';
import { maskEmail } from '../utils/maskEmail.js';
import { SIGNUP_EMAIL_KEY, SIGNUP_OTP_LENGTH } from '../utils/signupSession.js';

function EnterCodeBody() {
  const navigate = useNavigate();
  const theme = useContext(AuthShellThemeContext);
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(59);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    try {
      const em = sessionStorage.getItem(SIGNUP_EMAIL_KEY);
      if (!em) {
        navigate('/signup', { replace: true });
        return;
      }
      setEmail(em);
    } catch {
      navigate('/signup', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const t = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [seconds]);

  const masked = useMemo(() => maskEmail(email), [email]);

  const muted = isDark ? 'text-slate-400' : '';
  const mutedStyle = !isDark ? { color: '#718096' } : undefined;
  const titleCls = isDark ? 'text-white' : 'text-[#1a202c]';

  const primaryBtn =
    isDark
      ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] shadow-[0_0_26px_rgba(59,130,246,0.45)] hover:brightness-110'
      : 'bg-[#3b82f6] shadow-[0_10px_28px_-6px_rgba(59,130,246,0.45)] hover:brightness-[1.03]';

  const disabledBtn = isDark ? 'bg-slate-700/85 text-slate-400' : 'bg-[#8eaafb] text-[#5c6c85]';

  const otpReady = otp.replace(/\D/g, '').length === SIGNUP_OTP_LENGTH;

  const onContinue = useCallback(async () => {
    if (!otpReady || !email) return;
    setBusy(true);
    setError('');
    try {
      const payload = await verifySignupOtp(email, otp.replace(/\D/g, ''));
      const session = payload?.session;
      if (session?.access_token) {
        applyAuthSession(session);
      }
      navigate('/signup/username');
    } catch (err) {
      setError(err.message || 'Invalid or expired code. Try again or request a new code.');
    } finally {
      setBusy(false);
    }
  }, [email, navigate, otp, otpReady]);

  const resend = async () => {
    if (!email || seconds > 0 || resendBusy) return;
    setResendBusy(true);
    setError('');
    try {
      await resendSignupOtp(email);
      setSeconds(59);
      setOtp('');
    } catch (err) {
      setError(err.message || 'Could not resend code.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch pb-6">
      <h1 className={`mb-3 text-center text-[1.45rem] font-extrabold tracking-tight sm:text-[1.65rem] ${titleCls}`}>
        Enter the code
      </h1>
      <p className={`mb-6 text-center text-[14px] leading-relaxed ${muted}`} style={mutedStyle}>
        Enter the {SIGNUP_OTP_LENGTH}-digit verification code that was sent to {masked}
      </p>

      <div className="mb-6 overflow-x-auto">
        <OtpSixBoxes
          value={otp}
          onChange={setOtp}
          disabled={busy}
          variant="signupLight"
          length={SIGNUP_OTP_LENGTH}
        />
      </div>

      <p className={`mb-6 text-center text-[13px] ${muted}`} style={mutedStyle}>
        {seconds > 0 ? (
          <>
            Don&apos;t see it? Send a new code in{' '}
            <span className="tabular-nums font-semibold">
              00:{String(seconds).padStart(2, '0')}
            </span>
          </>
        ) : (
          <button
            type="button"
            disabled={resendBusy}
            onClick={resend}
            className={`font-semibold underline-offset-2 hover:underline disabled:opacity-50 ${
              isDark ? 'text-[#60a5fa]' : 'text-[#2b73fe]'
            }`}
          >
            {resendBusy ? 'Sending…' : 'Send a new code'}
          </button>
        )}
      </p>

      <button
        type="button"
        disabled={busy || !otpReady}
        onClick={onContinue}
        className={`w-full rounded-xl py-3.5 text-[15px] font-bold transition-all disabled:cursor-not-allowed ${
          busy || !otpReady ? disabledBtn : `text-white ${primaryBtn}`
        }`}
      >
        {busy ? 'Verifying…' : 'Continue'}
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
    </div>
  );
}

export default function SignupEnterCodePage() {
  return (
    <AuthFlowShell backTo="/signup/verify-email" backAriaLabel="Back">
      <EnterCodeBody />
    </AuthFlowShell>
  );
}
