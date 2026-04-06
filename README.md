# Trading Frontend

React port of `trading-backend/public/ohlc-signals.html`.

## Prerequisites

Run the API on port **5000** (e.g. `npm run dev` in `trading-backend`).

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api/*` to `http://localhost:5000`.

## Production build

```bash
npm run build
```

Serve `dist/` behind a reverse proxy that forwards `/api` to the backend, or set `window.TRADING_API_ORIGIN` / `localStorage.trading_api_origin` to the API base URL.

## Environment overrides

- `window.TRADING_API_ORIGIN` — API base URL (no trailing slash)
- `localStorage.setItem('trading_api_origin', 'https://...')` — same
