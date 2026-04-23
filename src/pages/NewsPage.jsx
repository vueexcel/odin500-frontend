import { useEffect, useMemo, useState } from 'react';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { useGeneralNewsFeed } from '../hooks/useGeneralNewsFeed.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { usePageSeo } from '../seo/usePageSeo.js';

const FINNHUB_BASE = 'https://finnhub.io/api/v1/company-news';
const FINNHUB_TOKEN =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FINNHUB_TOKEN) || '';
const INDEX_SYMBOLS = [
  { key: 'sp500', label: 'S&P 500', symbol: 'SPY' },
  { key: 'dow', label: 'Dow Jones', symbol: 'DIA' },
  { key: 'nasdaq100', label: 'Nasdaq 100', symbol: 'QQQ' }
];
const DEFAULT_TICKER = 'AAPL';

const FALLBACK_GENERAL = [
  {
    id: 'g1',
    headline: 'Market breadth improves as large-cap momentum cools.',
    source: 'Odin News Mock',
    time: 'sample',
    url: ''
  },
  {
    id: 'g2',
    headline: 'Rate-path uncertainty keeps volatility elevated into close.',
    source: 'Odin News Mock',
    time: 'sample',
    url: ''
  }
];
const FALLBACK_INDEX = [
  {
    id: 'i1',
    headline: 'ETF flows rotate toward defensive sectors this week.',
    source: 'Odin Index Desk',
    time: 'sample',
    url: ''
  },
  {
    id: 'i2',
    headline: 'Mega-cap earnings expectations drive index concentration discussion.',
    source: 'Odin Index Desk',
    time: 'sample',
    url: ''
  }
];
const FALLBACK_TICKER = [
  {
    id: 't1',
    headline: 'Company-specific headline feed unavailable; showing placeholder item.',
    source: 'Odin Ticker Desk',
    time: 'sample',
    url: ''
  }
];

function toIsoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function recentRange(days) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

function fmtTime(unixSec) {
  const ts = Number(unixSec);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function mapNews(row, prefix) {
  if (!row || typeof row !== 'object') return null;
  const headline = String(row.headline || '').trim();
  const id = row.id != null ? `${prefix}-${row.id}` : `${prefix}-${row.url || headline}`;
  if (!headline || !id) return null;
  return {
    id,
    headline,
    source: String(row.source || 'Finnhub').trim() || 'Finnhub',
    time: fmtTime(row.datetime) || '',
    url: String(row.url || '').trim()
  };
}

async function fetchCompanyNews(symbol, days = 7) {
  if (!FINNHUB_TOKEN) return [];
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return [];
  const { from, to } = recentRange(days);
  const qs = new URLSearchParams({ symbol: sym, from, to, token: FINNHUB_TOKEN });
  const res = await fetch(`${FINNHUB_BASE}?${qs.toString()}`);
  if (!res.ok) throw new Error(`News request failed (${res.status})`);
  const payload = await res.json();
  const list = Array.isArray(payload) ? payload : [];
  return list.map((r) => mapNews(r, sym)).filter(Boolean).slice(0, 24);
}

function NewsList({ title, subtitle, busy, error, items }) {
  return (
    <section className="news-page__card">
      <div className="news-page__head">
        <h2 className="news-page__title">{title}</h2>
        <p className="news-page__subtitle">{subtitle}</p>
      </div>
      {busy ? <p className="news-page__status">Loading…</p> : null}
      {!busy && error ? <p className="news-page__status news-page__status--err">{error}</p> : null}
      {!busy && !error && !items.length ? <p className="news-page__status">No headlines.</p> : null}
      <ul className="news-page__list">
        {items.map((n) => (
          <li key={n.id} className="news-page__item">
            <a
              className="news-page__link"
              href={n.url || '#'}
              onClick={(e) => {
                if (!n.url) e.preventDefault();
              }}
              target={n.url ? '_blank' : undefined}
              rel={n.url ? 'noopener noreferrer' : undefined}
            >
              {n.headline}
            </a>
            <div className="news-page__meta">
              <span>{n.source}</span>
              {n.time ? <span>{n.time}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function NewsPage() {
  usePageSeo({
    title: 'Market News, Index News, and Ticker News | Odin500',
    description:
      'Read general market headlines plus index-specific and ticker-specific news streams in Odin500.',
    canonicalPath: '/news'
  });
  const { busy: generalBusy, error: generalError, items: generalItemsAll } = useGeneralNewsFeed();
  const generalItems = useMemo(
    () => (generalItemsAll.length ? generalItemsAll.slice(0, 24) : FALLBACK_GENERAL),
    [generalItemsAll]
  );

  const [indexKey, setIndexKey] = useState(INDEX_SYMBOLS[0].key);
  const [indexBusy, setIndexBusy] = useState(false);
  const [indexError, setIndexError] = useState('');
  const [indexItems, setIndexItems] = useState([]);

  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [tickerBusy, setTickerBusy] = useState(false);
  const [tickerError, setTickerError] = useState('');
  const [tickerItems, setTickerItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const active = INDEX_SYMBOLS.find((i) => i.key === indexKey) || INDEX_SYMBOLS[0];
    (async () => {
      setIndexBusy(true);
      setIndexError('');
      try {
        const rows = await fetchCompanyNews(active.symbol, 10);
        if (cancelled) return;
        setIndexItems(rows.length ? rows : FALLBACK_INDEX);
      } catch (e) {
        if (!cancelled) {
          setIndexError(e?.message || 'Failed to load index-specific headlines.');
          setIndexItems(FALLBACK_INDEX);
        }
      } finally {
        if (!cancelled) setIndexBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [indexKey]);

  useEffect(() => {
    let cancelled = false;
    const symbol = sanitizeTickerPageInput(ticker) || DEFAULT_TICKER;
    (async () => {
      setTickerBusy(true);
      setTickerError('');
      try {
        const rows = await fetchCompanyNews(symbol, 10);
        if (cancelled) return;
        setTickerItems(rows.length ? rows : FALLBACK_TICKER);
      } catch (e) {
        if (!cancelled) {
          setTickerError(e?.message || 'Failed to load ticker headlines.');
          setTickerItems(FALLBACK_TICKER);
        }
      } finally {
        if (!cancelled) setTickerBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <div className="news-page">
      <header className="news-page__hero">
        <h1>News Center</h1>
        <p>General market headlines plus index-focused and ticker-focused streams in one place.</p>
      </header>

      <div className="news-page__grid">
        <NewsList
          title="General Market News"
          subtitle="Live general trading feed (updates every 30s)."
          busy={generalBusy}
          error={generalError}
          items={generalItems}
        />

        <section className="news-page__card">
          <div className="news-page__head">
            <h2 className="news-page__title">Index-Specific News</h2>
            <p className="news-page__subtitle">Choose an index proxy to focus headlines.</p>
          </div>
          <div className="news-page__controls">
            <label>
              Index
              <select className="news-page__select" value={indexKey} onChange={(e) => setIndexKey(e.target.value)}>
                {INDEX_SYMBOLS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label} ({opt.symbol})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <NewsList
            title=""
            subtitle=""
            busy={indexBusy}
            error={indexError}
            items={indexItems}
          />
        </section>

        <section className="news-page__card">
          <div className="news-page__head">
            <h2 className="news-page__title">Ticker-Specific News</h2>
            <p className="news-page__subtitle">Type any symbol and load company-focused headlines.</p>
          </div>
          <div className="news-page__controls news-page__controls--ticker">
            <label htmlFor="news-page-ticker">Ticker</label>
            <TickerSymbolCombobox
              symbol={ticker}
              onSymbolChange={(next) => setTicker(sanitizeTickerPageInput(next) || DEFAULT_TICKER)}
              inputId="news-page-ticker"
              placeholder="Search ticker (e.g. AAPL)"
            />
          </div>
          <NewsList
            title=""
            subtitle=""
            busy={tickerBusy}
            error={tickerError}
            items={tickerItems}
          />
        </section>
      </div>
    </div>
  );
}

