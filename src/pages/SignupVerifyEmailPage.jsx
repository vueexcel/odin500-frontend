import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthFlowShell } from '../components/AuthFlowShell.jsx';
import { AuthShellThemeContext } from '../components/AuthSplitShell.jsx';
import { SIGNUP_EMAIL_KEY } from '../utils/signupSession.js';

function VerifyBody() {
  const navigate = useNavigate();
  const theme = useContext(AuthShellThemeContext);
  const isDark = theme === 'dark';

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

  const resend = () => {
    /* Wire to backend resend endpoint when available */
  };

  return (
    <div className="flex flex-col items-stretch pb-6">
      <h1 className={`mb-3 text-center text-[1.45rem] font-extrabold tracking-tight sm:text-[1.65rem] ${titleCls}`}>
        Verify your email
      </h1>
      <p className={`mb-6 text-center text-[14px] leading-relaxed ${muted}`} style={mutedStyle}>
        The verification link has been sent. If you don&apos;t have it in your inbox, check spam/junk box.
      </p>

      <button
        type="button"
        onClick={resend}
        className={`mb-6 text-center text-[13px] font-semibold ${
          isDark ? 'text-[#60a5fa] hover:text-[#93c5fd]' : 'text-[#2b73fe] hover:text-[#1d5ee0]'
        }`}
      >
        Resend activation link
      </button>

      <button
        type="button"
        onClick={() => navigate('/signup/enter-code')}
        className={`w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all ${primaryBtn}`}
      >
        Continue
      </button>

      <button
        type="button"
        onClick={() => navigate('/signup')}
        className={`mt-4 w-full rounded-xl py-3 text-[14px] font-semibold ${
          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Back to sign up
      </button>
    </div>
  );
}

export default function SignupVerifyEmailPage() {
  return (
    <AuthFlowShell backTo="/signup" backAriaLabel="Back to sign up">
      <VerifyBody />
    </AuthFlowShell>
  );
}
