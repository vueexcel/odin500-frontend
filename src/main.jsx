import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import { ProtectedLayout } from './components/ProtectedLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SimplePage from './pages/SimplePage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import MarketHeatmapPage from './pages/MarketHeatmapPage.jsx';
import OdinSignalsPage from './pages/OdinSignalsPage.jsx';
import TickerPage from './pages/TickerPage.jsx';
import IndexPage from './pages/IndexPage.jsx';
import MarketMoversPage from './pages/MarketMoversPage.jsx';
import Pricing from './pages/Pricing.jsx';
import './index.css';
import { initAuthSessionOnLoad } from './store/apiStore.js';

initAuthSessionOnLoad();

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('auth_token');
  return token ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
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
          <Route path="/odin-signals" element={<OdinSignalsPage />} />
          <Route path="/accounts" element={<SimplePage title="Accounts" />} />
          <Route path="/premium" element={<Pricing />} />
          <Route path="/about" element={<SimplePage title="About" />} />
          <Route path="/pricing"  />
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
    </BrowserRouter>
  </React.StrictMode>
);
