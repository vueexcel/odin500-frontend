import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup } from '../services/authApi.js';
import { SiteFooter } from '../components/SiteFooter.jsx';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
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
    <div className="flex min-h-screen flex-col">
      <div className="auth-page auth-page--with-footer">
      <div className="auth-card">
        <h1>Sign Up</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="signupEmail">Email</label>
          <input
            id="signupEmail"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="signupPassword">Password</label>
          <input
            id="signupPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" disabled={busy}>
            {busy ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        {error ? <div className="status error">{error}</div> : null}
        {message ? <div className="status ok">{message}</div> : null}
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
}
