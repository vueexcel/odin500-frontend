import { useCallback } from 'react';
import { useLoginGateOptional } from '../context/LoginGateContext.jsx';
import { useIsLoggedIn } from './useIsLoggedIn.js';

/**
 * Wraps a CSV export handler: logged-out users see the login-required modal.
 */
export function useGatedCsvDownload(downloadFn) {
  const loggedIn = useIsLoggedIn();
  const gate = useLoginGateOptional();

  return useCallback(() => {
    if (!loggedIn) {
      gate?.showLoginRequired();
      return;
    }
    if (typeof downloadFn === 'function') downloadFn();
  }, [loggedIn, gate, downloadFn]);
}
