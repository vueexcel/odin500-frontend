import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import App from './App.jsx';
import { ProtectedLayout } from './components/ProtectedLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import SignupVerifyEmailPage from './pages/SignupVerifyEmailPage.jsx';
import SignupEnterCodePage from './pages/SignupEnterCodePage.jsx';
import SignupUsernamePage from './pages/SignupUsernamePage.jsx';
import MarketHeatmapPage from './pages/MarketHeatmapPage.jsx';
import OdinSignalsPage from './pages/OdinSignalsPage.jsx';
import TickerPage from './pages/TickerPage.jsx';
import IndexPage from './pages/IndexPage.jsx';
import MarketMoversPage from './pages/MarketMoversPage.jsx';
import StatisticDataPage from './pages/StatisticDataPage.jsx';
import TickerAnnualPage from './pages/TickerAnnualPage.jsx';
import TickerQuarterlyPage from './pages/TickerQuarterlyPage.jsx';
import TickerMonthlyPage from './pages/TickerMonthlyPage.jsx';
import TickerWeeklyPage from './pages/TickerWeeklyPage.jsx';
import TickerDailyPage from './pages/TickerDailyPage.jsx';
import HistoricalDataPage from './pages/HistoricalDataPage.jsx';
import NewsPage from './pages/NewsPage.jsx';
import Pricing from './pages/Pricing.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import './index.css';
import { initAuthSessionOnLoad } from './store/apiStore.js';
import { DEFAULT_INDEX_ROUTE_SLUG, DEFAULT_TICKER_ROUTE_SYMBOL } from './utils/tickerUrlSync.js';

initAuthSessionOnLoad();

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('auth_token');
  return token ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const location = useLocation();
  React.useEffect(() => {
    console.info('[router] AppRoutes location changed', {
      pathname: location.pathname,
      search: location.search,
      key: location.key
    });
  }, [location.pathname, location.search, location.key]);

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
          element={<Navigate to={`/ticker-annual/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-annual/:symbol" element={<TickerAnnualPage />} />
        <Route
          path="/ticker-quarterly"
          element={<Navigate to={`/ticker-quarterly/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-quarterly/:symbol" element={<TickerQuarterlyPage />} />
        <Route
          path="/ticker-monthly"
          element={<Navigate to={`/ticker-monthly/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-monthly/:symbol" element={<TickerMonthlyPage />} />
        <Route
          path="/ticker-weekly"
          element={<Navigate to={`/ticker-weekly/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-weekly/:symbol" element={<TickerWeeklyPage />} />
        <Route
          path="/ticker-daily"
          element={<Navigate to={`/ticker-daily/${DEFAULT_TICKER_ROUTE_SYMBOL}`} replace />}
        />
        <Route path="/ticker-daily/:symbol" element={<TickerDailyPage />} />
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
);
