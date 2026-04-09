import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/authApi.js';
import { applyAuthSession } from '../store/apiStore.js';
import { SiteFooter } from '../components/SiteFooter.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="auth-page auth-page--with-footer">
      <div className="auth-card">
        <h1>Login</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="loginEmail">Email</label>
          <input
            id="loginEmail"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="loginPassword">Password</label>
          <input
            id="loginPassword"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        {error ? <div className="status error">{error}</div> : null}
        <p className="auth-switch">
          Do not have an account? <Link to="/signup">Create one</Link>
        </p>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
}
