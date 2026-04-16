import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { signup } from '../services/authApi.js';
import { AuthField, AuthShellThemeContext, AuthSplitShell } from '../components/AuthSplitShell.jsx';

function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const theme = useContext(AuthShellThemeContext);
  const isDark = theme === 'dark';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const em = String(email || '').trim();
    if (!em || !password) {
      setError('Email and password are required.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await signup(em, password);
      setMessage('Signup successful. You can now sign in.');
      setTimeout(() => navigate('/login', { replace: true }), 600);
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <AuthField
        id="signupEmail"
        type="email"
        autoComplete="username"
        placeholder="Enter Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        icon={Mail}
      />
      <AuthField
        id="signupPassword"
        type="password"
        autoComplete="new-password"
        placeholder="Enter Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        icon={KeyRound}
        showPasswordToggle
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((v) => !v)}
      />

      <button
        type="submit"
        disabled={busy}
        className={`mt-2 w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all disabled:opacity-60 ${
          isDark
            ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] shadow-[0_0_26px_rgba(59,130,246,0.45),0_10px_28px_-8px_rgba(37,99,235,0.55)] hover:brightness-110'
            : 'bg-gradient-to-r from-[#2563eb] to-[#2b73fe] shadow-[0_10px_28px_-6px_rgba(43,115,254,0.55)] hover:brightness-[1.03]'
        }`}
      >
        {busy ? 'Creating account...' : 'Sign up'}
      </button>

      {error ? (
        <div
          className={`rounded-lg px-3 py-2 text-center text-[13px] font-medium ${
            isDark ? 'bg-red-950/50 text-red-200 ring-1 ring-red-500/30' : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          className={`rounded-lg px-3 py-2 text-center text-[13px] font-medium ${
            isDark ? 'bg-emerald-950/40 text-emerald-200 ring-1 ring-emerald-500/25' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
          }`}
          role="status"
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}

export default function SignupPage() {
  return (
    <AuthSplitShell title="Create your account">
      <SignupForm />
    </AuthSplitShell>
  );
}
