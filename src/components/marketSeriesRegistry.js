export const MARKET_SERIES = [
  /** `symbol` = short label in UI (e.g. DJI); `ticker` = OHLC / API symbol (e.g. DIA). */
  { key: 'NDX', label: 'Nasdaq 100', ticker: 'QQQ', symbol: 'NDX', color: '#7a2fff', badge: '#5b21b6', tone: 'purple', group: 'us' },
  { key: 'INDU', label: 'Dow Jones', ticker: 'DIA', symbol: 'DJI', color: '#ff6b00', badge: '#9a3412', tone: 'orange', group: 'us' },
  { key: 'SPX', label: 'S&P 500', ticker: 'SPY', symbol: 'SPX', color: '#56208E', badge: '#1e40af', tone: 'blue', group: 'us' },

  { key: 'XLB', label: 'Materials', ticker: 'XLB', addon: 'Select Sector SPDR Fund', color: '#6b7280', badge: '#374151', tone: 'gray', group: 'sector' },
  { key: 'XLK', label: 'Technology', ticker: 'XLK', addon: 'Select Sector SPDR Fund', color: '#00b894', badge: '#065f46', tone: 'teal', group: 'sector' },
  { key: 'XLF', label: 'Financials', ticker: 'XLF', addon: 'Select Sector SPDR Fund', color: '#ff3b3b', badge: '#7f1d1d', tone: 'red', group: 'sector' },
  { key: 'XLV', label: 'Healthcare', ticker: 'XLV', color: '#812046', badge: '#075985', tone: 'sky', group: 'sector' },
  { key: 'XLI', label: 'Industrials', ticker: 'XLI', addon: 'Select Sector SPDR Fund', color: '#a16207', badge: '#422006', tone: 'brown', group: 'sector' },
  { key: 'XLE', label: 'Energy', ticker: 'XLE', addon: 'Select Sector SPDR Fund', color: '#d4af37', badge: '#78350f', tone: 'gold', group: 'sector' },
  { key: 'XLY', label: 'Consumer Discretionary', ticker: 'XLY', addon: 'Select Sector SPDR Fund', color: '#95658A', badge: '#7c2d12', tone: 'orange', group: 'sector' },
  { key: 'XLP', label: 'Consumer Staples', ticker: 'XLP', addon: 'Select Sector SPDR Fund', color: '#22c55e', badge: '#14532d', tone: 'green', group: 'sector' },
  { key: 'XLU', label: 'Utilities', ticker: 'XLU', addon: 'Select Sector SPDR Fund', color: '#a78bfa', badge: '#4c1d95', tone: 'purple', group: 'sector' },
  { key: 'XLRE', label: 'Real Estate', ticker: 'XLRE', addon: 'Select Sector SPDR Fund', color: '#ec4899', badge: '#831843', tone: 'pink', group: 'sector' },
  { key: 'XLC', label: 'Communication Services', ticker: 'XLC', addon: 'Select Sector SPDR Fund', color: '#06b6d4', badge: '#155e75', tone: 'cyan', group: 'sector' },

  /** Client list — Other Markets (ETFs); `ticker` = OHLC symbol. */

  { key: 'GLD', label: 'Gold', ticker: 'GLD', color: '#eab308', badge: '#713f12', tone: 'gold', group: 'other' },
  { key: 'SLV', label: 'Silver', ticker: 'SLV', color: '#94a3b8', badge: '#334155', tone: 'gray', group: 'other' },
  { key: 'USO', label: 'Oil', ticker: 'USO', color: '#0f766e', badge: '#134e4a', tone: 'teal', group: 'other' },
  { key: 'UNG', label: 'Natural Gas', ticker: 'UNG', color: '#22d3ee', badge: '#155e75', tone: 'cyan', group: 'other' },
  { key: 'TLT', label: '20+ Yr Treasury', ticker: 'TLT', color: '#6366f1', badge: '#312e81', tone: 'indigo', group: 'other' },
  // { key: 'HYG', label: 'High Yield Bond', ticker: 'HYG', color: '#ec4899', badge: '#831843', tone: 'pink', group: 'other' },
  // { key: 'EEM', label: 'Emerging Markets', ticker: 'EEM', color: '#00ff6a', badge: '#14532d', tone: 'lime', group: 'other' },
  // { key: 'EFA', label: 'EAFE', ticker: 'EFA', color: '#ff00aa', badge: '#831843', tone: 'pink', group: 'other' },
  // { key: 'VTI', label: 'Total Stock Mkt', ticker: 'VTI', color: '#3b82f6', badge: '#1e3a8a', tone: 'blue', group: 'other' },
  // { key: 'VOO', label: 'Vanguard S&P 500', ticker: 'VOO', color: '#2563eb', badge: '#172554', tone: 'blue', group: 'other' },
  // { key: 'VEA', label: 'Dev. Markets', ticker: 'VEA', color: '#8b5cf6', badge: '#4c1d95', tone: 'purple', group: 'other' },
  // { key: 'VWO', label: 'Em. Markets', ticker: 'VWO', color: '#10b981', badge: '#064e3b', tone: 'green', group: 'other' },
  // { key: 'BND', label: 'Total Bond', ticker: 'BND', color: '#64748b', badge: '#1e293b', tone: 'gray', group: 'other' },
  // { key: 'AGG', label: 'US Aggregate Bond', ticker: 'AGG', color: '#78716c', badge: '#44403c', tone: 'brown', group: 'other' }
];

export const META_BY_KEY = Object.fromEntries(MARKET_SERIES.map((s) => [s.key, s]));
export const TICKER_BY_KEY = Object.fromEntries(MARKET_SERIES.map((s) => [s.key, s.ticker]));
export const DEFAULT_SELECTED_KEYS = ['INDU', 'SPX', 'NDX', 'XLK'];
