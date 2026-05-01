import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { ProtectedLayout } from './components/ProtectedLayout.jsx';
import { PageRouteFallback } from './components/PageRouteFallback.jsx';
import { RouteErrorBoundary } from './components/RouteErrorBoundary.jsx';
import './index.css';
import { initAuthSessionOnLoad } from './store/apiStore.js';
import { DEFAULT_INDEX_ROUTE_SLUG, DEFAULT_TICKER_ROUTE_SYMBOL } from './utils/tickerUrlSync.js';

const App = lazy(() => import('./App.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const SignupPage = lazy(() => import('./pages/SignupPage.jsx'));
const SignupVerifyEmailPage = lazy(() => import('./pages/SignupVerifyEmailPage.jsx'));
const SignupEnterCodePage = lazy(() => import('./pages/SignupEnterCodePage.jsx'));
const SignupUsernamePage = lazy(() => import('./pages/SignupUsernamePage.jsx'));
const MarketHeatmapPage = lazy(() => import('./pages/MarketHeatmapPage.jsx'));
const OdinSignalsPage = lazy(() => import('./pages/OdinSignalsPage.jsx'));
const TickerPage = lazy(() => import('./pages/TickerPage.jsx'));
const IndexPage = lazy(() => import('./pages/IndexPage.jsx'));
const MarketMoversPage = lazy(() => import('./pages/MarketMoversPage.jsx'));
const StatisticDataPage = lazy(() => import('./pages/StatisticDataPage.jsx'));
const TickerAnnualPage = lazy(() => import('./pages/TickerAnnualPage.jsx'));
const TickerQuarterlyPage = lazy(() => import('./pages/TickerQuarterlyPage.jsx'));
const TickerMonthlyPage = lazy(() => import('./pages/TickerMonthlyPage.jsx'));
const TickerWeeklyPage = lazy(() => import('./pages/TickerWeeklyPage.jsx'));
const TickerDailyPage = lazy(() => import('./pages/TickerDailyPage.jsx'));
const HistoricalDataPage = lazy(() => import('./pages/HistoricalDataPage.jsx'));
const NewsPage = lazy(() => import('./pages/NewsPage.jsx'));
const Pricing = lazy(() => import('./pages/Pricing.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const AccountsPage = lazy(() => import('./pages/AccountsPage.jsx'));

initAuthSessionOnLoad();

/** Old `/ticker-annual/SYM` (etc.) → `/statistic/ticker-annual/SYM` */
function LegacyTickerStatRedirect({ kind }) {
  const { symbol } = useParams();
  const sym = symbol || DEFAULT_TICKER_ROUTE_SYMBOL;
  return <Navigate to={`/statistic/${kind}/${encodeURIComponent(sym)}`} replace />;
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('auth_token');
  return token ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/signup/verify-email" element={<SignupVerifyEmailPage />} />
      <Route path="/signup/enter-code" element={<SignupEnterCodePage />} />
      <Route path="/signup/username" element={<SignupUsernamePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        element={
          <ProtectedRoute>
            <ProtectedLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/market" element={<App />} />
        <Route path="/tickers" element={<Navigate to="/odin-signals" replace />} />
        <Route path="/ticker" element={<Navigate to={`/ticker/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />} />
        <Route path="/ticker/:symbol" element={<TickerPage />} />
        <Route path="/indices" element={<Navigate to={`/indices/${DEFAULT_INDEX_ROUTE_SLUG}`} replace />} />
        <Route path="/indices/:indexSlug" element={<IndexPage />} />
        <Route path="/heatmap" element={<MarketHeatmapPage />} />
        <Route path="/market-movers" element={<MarketMoversPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/odin-signals" element={<OdinSignalsPage />} />
        <Route path="/statistic-data" element={<StatisticDataPage />} />
        <Route
          path="/ticker-annual"
          element={<Navigate to={`/statistic/ticker-annual/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-annual/:symbol" element={<LegacyTickerStatRedirect kind="ticker-annual" />} />
        <Route
          path="/ticker-quarterly"
          element={<Navigate to={`/statistic/ticker-quarterly/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-quarterly/:symbol" element={<LegacyTickerStatRedirect kind="ticker-quarterly" />} />
        <Route
          path="/ticker-monthly"
          element={<Navigate to={`/statistic/ticker-monthly/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-monthly/:symbol" element={<LegacyTickerStatRedirect kind="ticker-monthly" />} />
        <Route
          path="/ticker-weekly"
          element={<Navigate to={`/statistic/ticker-weekly/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-weekly/:symbol" element={<LegacyTickerStatRedirect kind="ticker-weekly" />} />
        <Route
          path="/ticker-daily"
          element={<Navigate to={`/statistic/ticker-daily/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-daily/:symbol" element={<LegacyTickerStatRedirect kind="ticker-daily" />} />
        <Route
          path="/statistic/ticker-annual"
          element={<Navigate to={`/statistic/ticker-annual/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/statistic/ticker-annual/:symbol" element={<TickerAnnualPage />} />
        <Route
          path="/statistic/ticker-quarterly"
          element={<Navigate to={`/statistic/ticker-quarterly/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/statistic/ticker-quarterly/:symbol" element={<TickerQuarterlyPage />} />
        <Route
          path="/statistic/ticker-monthly"
          element={<Navigate to={`/statistic/ticker-monthly/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/statistic/ticker-monthly/:symbol" element={<TickerMonthlyPage />} />
        <Route
          path="/statistic/ticker-weekly"
          element={<Navigate to={`/statistic/ticker-weekly/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/statistic/ticker-weekly/:symbol" element={<TickerWeeklyPage />} />
        <Route
          path="/statistic/ticker-daily"
          element={<Navigate to={`/statistic/ticker-daily/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/statistic/ticker-daily/:symbol" element={<TickerDailyPage />} />
        <Route path="/historical-data" element={<HistoricalDataPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/premium" element={<Pricing />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pricing" />
      </Route>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/market" replace />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/market" replace />} />
    </Routes>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageRouteFallback />}>
        <AppRoutes />
      </Suspense>
    </RouteErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </React.StrictMode>
);
