import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { AuthForgotShell } from '../components/AuthForgotShell.jsx';
import { OtpSixBoxes } from '../components/OtpSixBoxes.jsx';
import { AuthField, AuthShellThemeContext } from '../components/AuthSplitShell.jsx';

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

function ForgotPasswordFlow() {
  const navigate = useNavigate();
  const theme = useContext(AuthShellThemeContext);
  const isDark = theme === 'dark';

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

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
    otpOk &&
    rulesOk &&
    String(newPassword).length > 0 &&
    newPassword === confirmPassword;

  const primaryBtn =
    isDark
      ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] shadow-[0_0_26px_rgba(59,130,246,0.45),0_10px_28px_-8px_rgba(37,99,235,0.55)] hover:brightness-110'
      : 'bg-[#3b82f6] shadow-[0_10px_28px_-6px_rgba(59,130,246,0.5)] hover:brightness-[1.03]';

  const disabledBtn =
    isDark ? 'bg-slate-700/85 text-slate-400 shadow-none' : 'bg-[#8eaafb] text-[#5c6c85] shadow-none';

  const sendCode = async (e) => {
    e.preventDefault();
    if (!emailOk) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 450));
    setBusy(false);
    setStep('reset');
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!canReset || mismatch) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    setStep('success');
  };

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

  if (step === 'reset') {
    return (
      <form className="grid gap-5" onSubmit={resetPassword} noValidate>
        <div>
          <h1 className={`mb-2 text-center text-[1.45rem] font-extrabold tracking-tight sm:text-[1.65rem] ${titleColor}`}>
            Reset password
          </h1>
          <p className={`text-center text-[14px] leading-relaxed ${mutedColor}`} style={mutedStyle}>
            Enter the code we sent you, then choose a new password.
          </p>
        </div>

        <div className="grid gap-2">
          <span className={`text-[13px] font-semibold ${isDark ? 'text-slate-200' : 'text-[#1a202c]'}`}>Verification code</span>
          <OtpSixBoxes value={otp} onChange={setOtp} disabled={busy} />
        </div>

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
          Enter the email to which the account is registered, and we will send a code to reset the password
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

      <button
        type="submit"
        disabled={busy || !emailOk}
        className={`mt-1 w-full rounded-xl py-3.5 text-[15px] font-bold transition-all disabled:cursor-not-allowed ${
          busy || !emailOk ? disabledBtn : `text-white ${primaryBtn}`
        }`}
      >
        {busy ? 'Sending...' : 'Send Code'}
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
