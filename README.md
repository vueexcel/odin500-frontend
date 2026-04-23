# Trading Frontend

React port of `trading-backend/public/ohlc-signals.html`.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). In dev, Vite proxies `/api/*` to `PRODUCTION_API_ORIGIN` in `src/utils/apiOrigin.js` (same Render URL as production builds).

## Production build

```bash
npm run build
```

Serve `dist/` behind a reverse proxy that forwards `/api` to the backend, or set `window.TRADING_API_ORIGIN` / `localStorage.trading_api_origin` to the API base URL.

## Environment overrides

- `window.TRADING_API_ORIGIN` — API base URL (no trailing slash)
- `localStorage.setItem('trading_api_origin', 'https://...')` — same
- `VITE_TICKER_SEARCH_DEBOUNCE_MS` — milliseconds to wait after the last keystroke before `GET /api/tickers/search` (default `400`, clamped 50–5000). See `src/config/tickerSearch.js`.
