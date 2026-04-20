import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { login, updateDisplayName } from '../services/authApi.js';
import { applyAuthSession } from '../store/apiStore.js';
import { AuthField, AuthShellThemeContext, AuthSplitShell } from '../components/AuthSplitShell.jsx';
import { PENDING_DISPLAY_NAME_KEY } from '../utils/signupSession.js';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
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
    try {
      const payload = await login(em, password);
      const session = payload?.session;
      if (!session?.access_token) {
        throw new Error('Login succeeded but no access token was returned.');
      }
      applyAuthSession(session);
      localStorage.setItem('market_api_email', em);
      try {
        const pending = sessionStorage.getItem(PENDING_DISPLAY_NAME_KEY);
        if (pending && String(pending).trim().length >= 2) {
          await updateDisplayName(String(pending).trim());
          sessionStorage.removeItem(PENDING_DISPLAY_NAME_KEY);
        }
      } catch {
        /* Pending display name save failed — user can update profile later */
      }
      if (remember) {
        try {
          localStorage.setItem('odin_login_remember', '1');
        } catch {
          /* ignore */
        }
      } else {
        try {
          localStorage.removeItem('odin_login_remember');
        } catch {
          /* ignore */
        }
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="loginEmail"
          type="email"
          autoComplete="username"
          placeholder="Enter Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={Mail}
        />
        <AuthField
          id="loginPassword"
          type="password"
          autoComplete="current-password"
          placeholder="Enter Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={KeyRound}
          showPasswordToggle
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
        />

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <label
            className={`flex cursor-pointer items-center gap-2 text-[13px] font-medium select-none ${
              isDark ? 'text-slate-200' : 'text-slate-700'
            }`}
          >
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className={`h-4 w-4 rounded border-2 bg-transparent ${
                isDark
                  ? 'border-slate-500 accent-[#3b82f6]'
                  : 'border-slate-400 accent-[#2b73fe]'
              }`}
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className={`text-[13px] font-semibold ${
              isDark ? 'text-[#60a5fa] hover:text-[#93c5fd]' : 'text-[#2b73fe] hover:text-[#1d5ee0]'
            }`}
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={busy}
          className={`mt-1 w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all disabled:opacity-60 ${
            isDark
              ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] shadow-[0_0_26px_rgba(59,130,246,0.45),0_10px_28px_-8px_rgba(37,99,235,0.55)] hover:brightness-110'
              : 'bg-gradient-to-r from-[#2563eb] to-[#2b73fe] shadow-[0_10px_28px_-6px_rgba(43,115,254,0.55)] hover:brightness-[1.03]'
          }`}
        >
          {busy ? 'Signing in...' : 'Sign in'}
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
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthSplitShell title="Welcome Back!">
      <LoginForm />
    </AuthSplitShell>
  );
}
