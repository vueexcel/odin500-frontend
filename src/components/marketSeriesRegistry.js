export const MARKET_SERIES = [
  { key: 'NDX', label: 'Nasdaq 100', ticker: 'QQQ', color: '#7a2fff', badge: '#5b21b6', tone: 'purple', group: 'us' },
  { key: 'INDU', label: 'Dow Jones', ticker: 'DIA', color: '#ff6b00', badge: '#9a3412', tone: 'orange', group: 'us' },
  { key: 'SPX', label: 'S&P 500', ticker: 'SPY', color: '#0088ff', badge: '#1e40af', tone: 'blue', group: 'us' },

  { key: 'XLB', label: 'Materials', ticker: 'XLB', color: '#6b7280', badge: '#374151', tone: 'gray', group: 'sector' },
  { key: 'XLK', label: 'Technology', ticker: 'XLK', color: '#00b894', badge: '#065f46', tone: 'teal', group: 'sector' },
  { key: 'XLF', label: 'Financials', ticker: 'XLF', color: '#ff3b3b', badge: '#7f1d1d', tone: 'red', group: 'sector' },
  { key: 'XLV', label: 'Healthcare', ticker: 'XLV', color: '#00c2ff', badge: '#075985', tone: 'sky', group: 'sector' },
  { key: 'XLI', label: 'Industrials', ticker: 'XLI', color: '#a16207', badge: '#422006', tone: 'brown', group: 'sector' },
  { key: 'XLE', label: 'Energy', ticker: 'XLE', color: '#d4af37', badge: '#78350f', tone: 'gold', group: 'sector' },

  { key: 'EFA', label: 'Developed', ticker: 'EFA', color: '#ff00aa', badge: '#831843', tone: 'pink', group: 'other' },
  { key: 'EEM', label: 'Developing', ticker: 'EEM', color: '#00ff6a', badge: '#14532d', tone: 'lime', group: 'other' },
  { key: 'VGK', label: 'Europe', ticker: 'VGK', color: '#3f00ff', badge: '#2e1065', tone: 'indigo', group: 'other' },
  { key: 'EWJ', label: 'Japan', ticker: 'EWJ', color: '#ff1493', badge: '#831843', tone: 'rose', group: 'other' },
  { key: 'MCHI', label: 'China', ticker: 'MCHI', color: '#00e5ff', badge: '#164e63', tone: 'cyan', group: 'other' }
];

export const META_BY_KEY = Object.fromEntries(MARKET_SERIES.map((s) => [s.key, s]));
export const TICKER_BY_KEY = Object.fromEntries(MARKET_SERIES.map((s) => [s.key, s.ticker]));
export const DEFAULT_SELECTED_KEYS = ['INDU', 'SPX', 'NDX', 'XLK'];
