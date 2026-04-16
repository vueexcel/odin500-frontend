export const MARKET_SERIES = [
  { key: 'IWM', label: 'Russell 2000', ticker: 'IWM', color: '#94a3b8', badge: '#475569', tone: 'muted', group: 'us' },
  { key: 'NDX', label: 'Nasdaq 100', ticker: 'QQQ', color: '#7a2fff', badge: '#7a2fff', tone: 'purple', group: 'us' },
  { key: 'INDU', label: 'Dow Jones', ticker: 'DIA', color: '#ff7d36', badge: '#ff7d36', tone: 'orange', group: 'us' },
  { key: 'SPX', label: 'S&P 500', ticker: 'SPY', color: '#2f8cff', badge: '#2f8cff', tone: 'blue', group: 'us' },
  { key: 'XLB', label: 'Materials', ticker: 'XLB', color: '#94a3b8', badge: '#475569', tone: 'muted', group: 'sector' },
  { key: 'XLK', label: 'Technology', ticker: 'XLK', color: '#97dbd5', badge: '#2f6f70', tone: 'mint', group: 'sector' },
  { key: 'XLF', label: 'Financials', ticker: 'XLF', color: '#ff7d36', badge: '#ff7d36', tone: 'orange', group: 'sector' },
  { key: 'XLV', label: 'Healthcare', ticker: 'XLV', color: '#2f8cff', badge: '#2f8cff', tone: 'blue', group: 'sector' },
  { key: 'XLI', label: 'Industrials', ticker: 'XLI', color: '#94a3b8', badge: '#475569', tone: 'muted', group: 'sector' },
  { key: 'XLE', label: 'Energy', ticker: 'XLE', color: '#7a2fff', badge: '#7a2fff', tone: 'purple', group: 'sector' },
  { key: 'EFA', label: 'Developed', ticker: 'EFA', color: '#94a3b8', badge: '#475569', tone: 'muted', group: 'other' },
  { key: 'EEM', label: 'Developing', ticker: 'EEM', color: '#97dbd5', badge: '#2f6f70', tone: 'mint', group: 'other' },
  { key: 'VGK', label: 'Europe', ticker: 'VGK', color: '#2f8cff', badge: '#2f8cff', tone: 'blue', group: 'other' },
  { key: 'EWJ', label: 'Japan', ticker: 'EWJ', color: '#ff7d36', badge: '#ff7d36', tone: 'orange', group: 'other' },
  { key: 'MCHI', label: 'China', ticker: 'MCHI', color: '#7a2fff', badge: '#7a2fff', tone: 'purple', group: 'other' }
];

export const META_BY_KEY = Object.fromEntries(MARKET_SERIES.map((s) => [s.key, s]));
export const TICKER_BY_KEY = Object.fromEntries(MARKET_SERIES.map((s) => [s.key, s.ticker]));
export const DEFAULT_SELECTED_KEYS = ['INDU', 'SPX', 'NDX', 'XLK'];
