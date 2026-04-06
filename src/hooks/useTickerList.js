import { useState, useEffect } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';

export function useTickerList(accessToken) {
  const [allTickers, setAllTickers] = useState([]);

  useEffect(() => {
    if (!accessToken) {
      setAllTickers([]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const groupsRes = await fetch(apiUrl('/api/tickers/groups'), {
          headers: { Authorization: 'Bearer ' + accessToken }
        });
        const groupsPayload = await groupsRes.json();
        if (!groupsRes.ok) throw new Error(groupsPayload.error || 'Failed to load ticker groups');
        const groups = Array.isArray(groupsPayload) ? groupsPayload : [];
        const symbols = [];
        for (let i = 0; i < groups.length; i++) {
          const code = String(groups[i].code || '').trim();
          if (!code) continue;
          const r = await fetch(apiUrl('/api/tickers/group/' + encodeURIComponent(code)), {
            headers: { Authorization: 'Bearer ' + accessToken }
          });
          const p = await r.json();
          if (!r.ok) continue;
          const list = Array.isArray(p.tickers) ? p.tickers : [];
          for (let j = 0; j < list.length; j++) {
            const sym = String(list[j].symbol || '').trim().toUpperCase();
            if (sym) symbols.push(sym);
          }
        }
        const unique = [];
        const seen = new Set();
        for (const s of symbols) {
          if (!seen.has(s)) {
            seen.add(s);
            unique.push(s);
          }
        }
        unique.sort();
        if (!cancelled) setAllTickers(unique);
      } catch {
        if (!cancelled) setAllTickers([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return allTickers;
}
