const accounts = [
  { name: 'Growth Alpha', type: 'Margin', broker: 'Interactive Brokers', balance: 124830.22, pnlDay: 1240.87, pnlPct: 1.01, risk: 'Medium' },
  { name: 'Dividend Core', type: 'Cash', broker: 'Schwab', balance: 68320.55, pnlDay: -212.4, pnlPct: -0.31, risk: 'Low' },
  { name: 'Options Lab', type: 'Portfolio Margin', broker: 'Tastytrade', balance: 42110.01, pnlDay: 566.9, pnlPct: 1.36, risk: 'High' }
];

const positions = [
  { symbol: 'NVDA', qty: 120, avg: 819.4, last: 834.23, value: 100107.6, pnl: 1779.6, pnlPct: 1.81 },
  { symbol: 'MSFT', qty: 85, avg: 412.7, last: 419.88, value: 35689.8, pnl: 610.3, pnlPct: 1.74 },
  { symbol: 'AAPL', qty: 150, avg: 187.12, last: 184.44, value: 27666, pnl: -402, pnlPct: -1.43 },
  { symbol: 'TSLA', qty: 48, avg: 173.5, last: 179.26, value: 8604.48, pnl: 276.48, pnlPct: 3.32 },
  { symbol: 'SPY', qty: 60, avg: 503.21, last: 508.66, value: 30519.6, pnl: 327, pnlPct: 1.08 }
];

const activity = [
  { time: '09:34 AM', event: 'Bought NVDA', detail: '20 @ 832.15', status: 'Filled' },
  { time: '10:11 AM', event: 'Sold AAPL', detail: '15 @ 185.02', status: 'Filled' },
  { time: '11:27 AM', event: 'Risk Alert', detail: 'Options Lab > max intraday loss threshold', status: 'Warning' },
  { time: '01:42 PM', event: 'Dividend Posted', detail: '$182.30 from MSFT', status: 'Settled' }
];

function money(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);
}

function pct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function toneClass(v) {
  if (v > 0) return 'accounts-tone-up';
  if (v < 0) return 'accounts-tone-down';
  return 'accounts-tone-flat';
}

export default function AccountsPage() {
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const dayPnl = accounts.reduce((s, a) => s + a.pnlDay, 0);
  const exposure = positions.reduce((s, p) => s + p.value, 0);
  const cashAvail = totalBalance * 0.32;
  const bpUsed = (exposure / totalBalance) * 100;

  return (
    <div className="accounts-page">
      <header className="accounts-hero">
        <div>
          <p className="accounts-hero__eyebrow">Portfolio command center</p>
          <h1 className="accounts-hero__title">Accounts</h1>
          <p className="accounts-hero__sub">
            Unified view of account balances, risk posture, open positions, and live trading activity.
          </p>
        </div>
        <div className="accounts-hero__actions">
          <button type="button" className="accounts-btn accounts-btn--ghost">Export Snapshot</button>
          <button type="button" className="accounts-btn accounts-btn--primary">Rebalance Planner</button>
        </div>
      </header>

      <section className="accounts-kpis">
        <article className="accounts-kpi">
          <span className="accounts-kpi__label">Net account value</span>
          <strong className="accounts-kpi__value">{money(totalBalance)}</strong>
        </article>
        <article className="accounts-kpi">
          <span className="accounts-kpi__label">Day P&L</span>
          <strong className={`accounts-kpi__value ${toneClass(dayPnl)}`}>{money(dayPnl)}</strong>
        </article>
        <article className="accounts-kpi">
          <span className="accounts-kpi__label">Buying power used</span>
          <strong className="accounts-kpi__value">{bpUsed.toFixed(1)}%</strong>
        </article>
        <article className="accounts-kpi">
          <span className="accounts-kpi__label">Cash available</span>
          <strong className="accounts-kpi__value">{money(cashAvail)}</strong>
        </article>
      </section>

      <section className="accounts-grid">
        <article className="accounts-card">
          <h2 className="accounts-card__title">Linked accounts</h2>
          <div className="accounts-account-list">
            {accounts.map((acc) => (
              <div className="accounts-account" key={acc.name}>
                <div>
                  <h3>{acc.name}</h3>
                  <p>{acc.type} · {acc.broker}</p>
                </div>
                <div className="accounts-account__nums">
                  <strong>{money(acc.balance)}</strong>
                  <span className={toneClass(acc.pnlPct)}>{pct(acc.pnlPct)} today</span>
                </div>
                <span className={`accounts-risk accounts-risk--${acc.risk.toLowerCase()}`}>{acc.risk} risk</span>
              </div>
            ))}
          </div>
        </article>

        <article className="accounts-card">
          <h2 className="accounts-card__title">Risk cockpit</h2>
          <div className="accounts-risk-grid">
            <div>
              <p className="accounts-mini__label">Concentration risk</p>
              <div className="accounts-meter"><span style={{ width: '68%' }} /></div>
              <p className="accounts-mini__value">68% (Tech-heavy)</p>
            </div>
            <div>
              <p className="accounts-mini__label">Beta exposure</p>
              <div className="accounts-meter"><span style={{ width: '54%' }} /></div>
              <p className="accounts-mini__value">1.14 portfolio beta</p>
            </div>
            <div>
              <p className="accounts-mini__label">Max drawdown buffer</p>
              <div className="accounts-meter"><span style={{ width: '41%' }} /></div>
              <p className="accounts-mini__value">4.1% to daily guardrail</p>
            </div>
          </div>
        </article>
      </section>

      <section className="accounts-grid accounts-grid--table">
        <article className="accounts-card">
          <div className="accounts-card__head">
            <h2 className="accounts-card__title">Top positions</h2>
            <button type="button" className="accounts-link-btn">Open full blotter</button>
          </div>
          <div className="accounts-table-wrap">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Avg</th>
                  <th>Last</th>
                  <th>Value</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.symbol}>
                    <td>{p.symbol}</td>
                    <td>{p.qty}</td>
                    <td>{money(p.avg)}</td>
                    <td>{money(p.last)}</td>
                    <td>{money(p.value)}</td>
                    <td className={toneClass(p.pnlPct)}>
                      {money(p.pnl)} <span>{pct(p.pnlPct)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="accounts-card">
          <div className="accounts-card__head">
            <h2 className="accounts-card__title">Live activity</h2>
            <button type="button" className="accounts-link-btn">View audit trail</button>
          </div>
          <div className="accounts-activity">
            {activity.map((a) => (
              <div className="accounts-activity__item" key={`${a.time}-${a.event}`}>
                <span className="accounts-activity__time">{a.time}</span>
                <div>
                  <p className="accounts-activity__event">{a.event}</p>
                  <p className="accounts-activity__detail">{a.detail}</p>
                </div>
                <span className={`accounts-activity__status accounts-activity__status--${a.status.toLowerCase()}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
