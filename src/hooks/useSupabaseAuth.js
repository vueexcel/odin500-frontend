import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { apiUrl } from '../utils/apiOrigin.js';

export function useSupabaseAuth() {
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch(apiUrl('/api/public/supabase-config'));
        const cfg = await res.json();
        if (!cfg.url || !cfg.anonKey) {
          if (!cancelled) {
            setInitError('Missing Supabase config on server (set SUPABASE_URL and SUPABASE_KEY in .env).');
          }
          return;
        }
        const sb = createClient(cfg.url, cfg.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
          }
        });
        if (cancelled) return;
        setClient(sb);
        sb.auth.onAuthStateChange((_event, sess) => {
          setSession(sess);
        });
        const { data } = await sb.auth.getSession();
        if (!cancelled) setSession(data.session);
      } catch (e) {
        if (!cancelled) {
          setInitError(e.message);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email, password) => {
      if (!client) return { error: new Error('Auth not initialized') };
      const { error } = await client.auth.signInWithPassword({ email, password });
      return { error };
    },
    [client]
  );

  const logout = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
  }, [client]);

  const authStatus = session?.user
    ? `Signed in as ${session.user.email}`
    : 'Not signed in';

  return {
    supabase: client,
    session,
    login,
    logout,
    authStatus,
    initError
  };
}
