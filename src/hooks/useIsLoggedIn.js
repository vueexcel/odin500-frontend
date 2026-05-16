import { useEffect, useState } from 'react';
import { getAuthToken } from '../store/apiStore.js';
import { useLoginGateOptional } from '../context/LoginGateContext.jsx';

/** Reactive logged-in flag (updates on sign-in / sign-out). */
export function useIsLoggedIn() {
  const gate = useLoginGateOptional();
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const onAuth = () => setEpoch((e) => e + 1);
    window.addEventListener('odin-auth-updated', onAuth);
    return () => window.removeEventListener('odin-auth-updated', onAuth);
  }, []);

  void epoch;
  if (gate) return gate.isLoggedIn;
  return Boolean(getAuthToken());
}
