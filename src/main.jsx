import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import { ProtectedLayout } from './components/ProtectedLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SimplePage from './pages/SimplePage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import TickersPage from './pages/TickersPage.jsx';
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
          <Route path="/tickers" element={<TickersPage />} />
          <Route path="/odin-signals" element={<SimplePage title="Odin Signals" />} />
          <Route path="/accounts" element={<SimplePage title="Accounts" />} />
          <Route path="/premium" element={<SimplePage title="Premium" />} />
          <Route path="/about" element={<SimplePage title="About" />} />
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
