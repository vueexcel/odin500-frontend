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
import HistoricalDataPage from './pages/HistoricalDataPage.jsx';
import NewsPage from './pages/NewsPage.jsx';
import Pricing from './pages/Pricing.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import './index.css';
import { initAuthSessionOnLoad } from './store/apiStore.js';

initAuthSessionOnLoad();

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('auth_token');
  return token ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes location={location} key={location.pathname}>
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
        <Route path="/ticker/:symbol?" element={<TickerPage />} />
        <Route path="/indices/:indexSlug?" element={<IndexPage />} />
        <Route path="/heatmap" element={<MarketHeatmapPage />} />
        <Route path="/market-movers" element={<MarketMoversPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/odin-signals" element={<OdinSignalsPage />} />
        <Route path="/statistic-data" element={<StatisticDataPage />} />
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
