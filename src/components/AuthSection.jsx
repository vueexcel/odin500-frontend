export function AuthSection({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onLogin,
  onLogout,
  authStatus,
  session,
  loginDisabled
}) {
  return (
    <div className="filters auth-row">
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="Account email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="loginBtn">&nbsp;</label>
        <button type="button" id="loginBtn" onClick={onLogin} disabled={loginDisabled}>
          Sign in
        </button>
      </div>
      <div className="field">
        <label htmlFor="logoutBtn">&nbsp;</label>
        <button
          type="button"
          id="logoutBtn"
          className="btn-secondary"
          onClick={onLogout}
          disabled={!session}
        >
          Sign out
        </button>
      </div>
      <div className="field">
        <label>Session</label>
        <div className="auth-status">{authStatus}</div>
      </div>
    </div>
  );
}
