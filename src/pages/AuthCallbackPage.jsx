import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowserClient.js';
import { applyAuthSession } from '../store/apiStore.js';

const OAUTH_TIMEOUT_MS = 5000;

/**
 * OAuth redirect target (e.g. Google). Parses URL hash into a session via Supabase,
 * then mirrors tokens into apiStore via applyAuthSession for fetchWithAuth / ProtectedRoute.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const finishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;
    const timerRef = { id: null };

    function finish(session) {
      if (finishedRef.current || cancelled || !session?.access_token) return;
      finishedRef.current = true;
      if (timerRef.id != null) {
        window.clearTimeout(timerRef.id);
        timerRef.id = null;
      }
      applyAuthSession(session);
      try {
        const em = session.user?.email;
        if (em) localStorage.setItem('market_api_email', String(em));
      } catch {
        /* ignore */
      }
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
      navigate('/', { replace: true });
    }

    function fail() {
      if (finishedRef.current || cancelled) return;
      finishedRef.current = true;
      if (timerRef.id != null) {
        window.clearTimeout(timerRef.id);
        timerRef.id = null;
      }
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
      navigate('/login?error=oauth', { replace: true });
    }

    timerRef.id = window.setTimeout(() => {
      fail();
    }, OAUTH_TIMEOUT_MS);

    (async () => {
      try {
        const sb = await getSupabaseBrowserClient();
        const {
          data: { session }
        } = await sb.auth.getSession();
        if (cancelled) return;
        if (session?.access_token) {
          finish(session);
          return;
        }

        const {
          data: { subscription }
        } = sb.auth.onAuthStateChange((_event, sess) => {
          if (sess?.access_token) finish(sess);
        });
        unsubscribe = () => {
          try {
            subscription.unsubscribe();
          } catch {
            /* ignore */
          }
        };
      } catch {
        fail();
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.id != null) window.clearTimeout(timerRef.id);
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
    };
  }, [navigate]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">Completing sign-in…</p>
      <p className="text-[13px] text-slate-500">Please wait.</p>
    </div>
  );
}
