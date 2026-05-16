import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../store/apiStore.js';
import { LoginRequiredModal } from '../components/LoginRequiredModal.jsx';

const LoginGateContext = createContext(null);

export function LoginGateProvider({ children }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [authEpoch, setAuthEpoch] = useState(0);

  useEffect(() => {
    const onAuth = () => setAuthEpoch((e) => e + 1);
    window.addEventListener('odin-auth-updated', onAuth);
    return () => window.removeEventListener('odin-auth-updated', onAuth);
  }, []);

  const isLoggedIn = Boolean(getAuthToken());
  void authEpoch;

  const showLoginRequired = useCallback(() => setOpen(true), []);
  const closeLoginRequired = useCallback(() => setOpen(false), []);

  const requireLogin = useCallback((onAllowed) => {
    if (Boolean(getAuthToken())) {
      if (typeof onAllowed === 'function') onAllowed();
      return true;
    }
    setOpen(true);
    return false;
  }, []);

  const goLogin = useCallback(() => {
    setOpen(false);
    navigate('/login');
  }, [navigate]);

  const goSignup = useCallback(() => {
    setOpen(false);
    navigate('/signup');
  }, [navigate]);

  const value = useMemo(
    () => ({ isLoggedIn, requireLogin, showLoginRequired }),
    [isLoggedIn, requireLogin, showLoginRequired]
  );

  return (
    <LoginGateContext.Provider value={value}>
      {children}
      <LoginRequiredModal open={open} onClose={closeLoginRequired} onLogin={goLogin} onSignup={goSignup} />
    </LoginGateContext.Provider>
  );
}

export function useLoginGate() {
  const ctx = useContext(LoginGateContext);
  if (!ctx) throw new Error('useLoginGate must be used within LoginGateProvider');
  return ctx;
}

export function useLoginGateOptional() {
  return useContext(LoginGateContext);
}
