/**
 * Warm lazy route chunks on hover/focus (matches `main.jsx` dynamic imports).
 * Idempotent; failed loads clear the key so a later hover can retry.
 */

const prefetched = new Set();

function markAndRun(key, loader) {
  if (prefetched.has(key)) return;
  prefetched.add(key);
  void loader().catch(() => {
    prefetched.delete(key);
  });
}

/** @param {string | { pathname?: string } | undefined} to */
export function prefetchRouteChunks(to) {
  const raw = typeof to === 'string' ? to : to && typeof to.pathname === 'string' ? to.pathname : '';
  if (!raw || raw === '#') return;
  const p = raw.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) return;

  if (p.startsWith('/statistic/ticker-annual') || p.startsWith('/ticker-annual')) {
    return markAndRun('ticker-annual', () => import('../pages/TickerAnnualPage.jsx'));
  }
  if (p.startsWith('/statistic/ticker-quarterly') || p.startsWith('/ticker-quarterly')) {
    return markAndRun('ticker-quarterly', () => import('../pages/TickerQuarterlyPage.jsx'));
  }
  if (p.startsWith('/statistic/ticker-monthly') || p.startsWith('/ticker-monthly')) {
    return markAndRun('ticker-monthly', () => import('../pages/TickerMonthlyPage.jsx'));
  }
  if (p.startsWith('/statistic/ticker-weekly') || p.startsWith('/ticker-weekly')) {
    return markAndRun('ticker-weekly', () => import('../pages/TickerWeeklyPage.jsx'));
  }
  if (p.startsWith('/statistic/ticker-daily') || p.startsWith('/ticker-daily')) {
    return markAndRun('ticker-daily', () => import('../pages/TickerDailyPage.jsx'));
  }
  if (p === '/ticker' || p.startsWith('/ticker/')) return markAndRun('ticker', () => import('../pages/TickerPage.jsx'));

  if (p === '/indices' || p.startsWith('/indices/')) return markAndRun('indices', () => import('../pages/IndexPage.jsx'));

  if (p.startsWith('/market')) return markAndRun('market', () => import('../App.jsx'));
  if (p.startsWith('/heatmap')) return markAndRun('heatmap', () => import('../pages/MarketHeatmapPage.jsx'));
  if (p.startsWith('/market-movers')) return markAndRun('market-movers', () => import('../pages/MarketMoversPage.jsx'));
  if (p.startsWith('/news')) return markAndRun('news', () => import('../pages/NewsPage.jsx'));
  if (p.startsWith('/odin-signals') || p.startsWith('/tickers')) {
    return markAndRun('odin-signals', () => import('../pages/OdinSignalsPage.jsx'));
  }
  if (p.startsWith('/statistic-data')) return markAndRun('statistic-data', () => import('../pages/StatisticDataPage.jsx'));
  if (p.startsWith('/historical-data')) return markAndRun('historical-data', () => import('../pages/HistoricalDataPage.jsx'));
  if (p.startsWith('/accounts')) return markAndRun('accounts', () => import('../pages/AccountsPage.jsx'));
  if (p.startsWith('/premium') || p.startsWith('/pricing')) return markAndRun('premium', () => import('../pages/Pricing.jsx'));
  if (p.startsWith('/about')) return markAndRun('about', () => import('../pages/AboutPage.jsx'));

  if (p.startsWith('/login')) return markAndRun('login', () => import('../pages/LoginPage.jsx'));
  if (p.startsWith('/forgot-password')) return markAndRun('forgot-password', () => import('../pages/ForgotPasswordPage.jsx'));
  if (p.startsWith('/signup/verify-email')) return markAndRun('signup-verify', () => import('../pages/SignupVerifyEmailPage.jsx'));
  if (p.startsWith('/signup/enter-code')) return markAndRun('signup-code', () => import('../pages/SignupEnterCodePage.jsx'));
  if (p.startsWith('/signup/username')) return markAndRun('signup-user', () => import('../pages/SignupUsernamePage.jsx'));
  if (p.startsWith('/signup')) return markAndRun('signup', () => import('../pages/SignupPage.jsx'));
}
