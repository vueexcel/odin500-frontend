import { createClient } from '@supabase/supabase-js';
import { apiUrl } from '../utils/apiOrigin.js';

/** Lazily created singleton — matches `/api/public/supabase-config` from the trading backend. */
let singletonPromise = null;

export function getSupabaseBrowserClient() {
  if (!singletonPromise) {
    singletonPromise = (async () => {
      const res = await fetch(apiUrl('/api/public/supabase-config'));
      const cfg = await res.json();
      if (!cfg.url || !cfg.anonKey) {
        throw new Error('Supabase is not configured (server needs SUPABASE_URL and SUPABASE_KEY).');
      }
      return createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined
        }
      });
    })();
  }
  return singletonPromise;
}
