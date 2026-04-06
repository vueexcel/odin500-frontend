function pickNumber(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      const n = Number(row[key]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

export function rowDateToTimeKey(row) {
  const d = row.Date != null ? row.Date : row.date;
  if (d == null || d === '') return '';
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const parsed = Date.parse(d);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
    return d.slice(0, 10);
  }
  if (typeof d === 'object' && d !== null) {
    if (typeof d.value === 'string') return rowDateToTimeKey({ Date: d.value });
    if (d.year != null && d.month != null && d.day != null) {
      return (
        d.year +
        '-' +
        String(d.month).padStart(2, '0') +
        '-' +
        String(d.day).padStart(2, '0')
      );
    }
  }
  return '';
}

function normalizeCandles(candles) {
  const byTime = new Map();
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!c || !c.time) continue;
    byTime.set(c.time, c);
  }
  return Array.from(byTime.keys())
    .sort()
    .map((t) => byTime.get(t));
}

export function mapRowsToCandles(rows) {
  const candles = [];
  for (const row of rows) {
    const time = rowDateToTimeKey(row);
    if (!time) continue;
    const open = pickNumber(row, ['Open', 'open', 'OPEN']);
    const high = pickNumber(row, ['High', 'high', 'HIGH']);
    const low = pickNumber(row, ['Low', 'low', 'LOW']);
    const close = pickNumber(row, ['Close', 'close', 'CLOSE']);
    if ([open, high, low, close].some((v) => v == null)) continue;
    candles.push({ time, open, high, low, close });
  }
  return normalizeCandles(candles);
}

export function filterMarkersForCandles(markers, candles) {
  const times = new Set();
  for (let i = 0; i < candles.length; i++) {
    times.add(candles[i].time);
  }
  return markers.filter((m) => times.has(m.time));
}

function markerFromTradeEvent(evt) {
  const isOpen = evt.kind === 'open';
  const isLong = evt.tradeType === 'long';
  if (isOpen) {
    return {
      time: evt.time,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: isLong ? '#22c55e' : '#ef4444',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: (isLong ? 'OPEN L' : 'OPEN S') + (evt.signal ? ':' + evt.signal : '')
    };
  }
  return {
    time: evt.time,
    position: isLong ? 'aboveBar' : 'belowBar',
    color: '#f59e0b',
    shape: 'circle',
    text: 'CLOSE' + (evt.signal ? ':' + evt.signal : '')
  };
}

export function normalizeTradeMarkers(markers) {
  const byTime = new Map();
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    if (!m || !m.time) continue;
    if (!byTime.has(m.time)) byTime.set(m.time, []);
    byTime.get(m.time).push(m);
  }
  const normalized = [];
  const times = Array.from(byTime.keys()).sort();
  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    const items = byTime.get(time);
    const below = items.filter((x) => x.position === 'belowBar');
    const above = items.filter((x) => x.position === 'aboveBar');
    if (below.length) {
      normalized.push({
        time,
        position: 'belowBar',
        color: below[below.length - 1].color,
        shape: below[below.length - 1].shape,
        text: below.map((x) => x.text).join(' | ')
      });
    }
    if (above.length) {
      normalized.push({
        time,
        position: 'aboveBar',
        color: above[above.length - 1].color,
        shape: above[above.length - 1].shape,
        text: above.map((x) => x.text).join(' | ')
      });
    }
  }
  return normalized.sort((a, b) => {
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    if (a.position === b.position) return 0;
    return a.position === 'belowBar' ? -1 : 1;
  });
}

export function extractOdinMarkersByTicker(payload) {
  const byTicker = new Map();
  const headers = Array.isArray(payload && payload.headers) ? payload.headers : [];
  const idx = {};
  headers.forEach((h, i) => {
    idx[String(h)] = i;
  });
  const iTradeId = idx['#'];
  const iTradeType = idx['Trade Type'];
  const iEntrySignal = idx['Entry Signal'];
  const iEntryExecDate =
    idx['Execution Date (Entry-T+1)'] != null
      ? idx['Execution Date (Entry-T+1)']
      : idx['Signal Date (Entry-T)'];
  const iExitSignal = idx['Exit Signal'];
  const iExitExecDate =
    idx['Execution Date (Exit-T+1)'] != null
      ? idx['Execution Date (Exit-T+1)']
      : idx['Signal Date (Exit-T)'];

  const results = Array.isArray(payload && payload.results_by_ticker)
    ? payload.results_by_ticker
    : [];
  for (let r = 0; r < results.length; r++) {
    const ticker = String(results[r].ticker || '').toUpperCase();
    const rows = Array.isArray(results[r].rows) ? results[r].rows : [];
    const events = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tradeId = iTradeId == null ? null : row[iTradeId];
      if (!Number.isFinite(Number(tradeId)) || Number(tradeId) <= 0) continue;
      const tradeType = String(iTradeType == null ? '' : row[iTradeType]).toLowerCase();
      const entryExec =
        iEntryExecDate == null ? '' : String(row[iEntryExecDate] || '').slice(0, 10);
      const exitExec =
        iExitExecDate == null ? '' : String(row[iExitExecDate] || '').slice(0, 10);
      const entrySignal =
        iEntrySignal == null ? '' : String(row[iEntrySignal] || '').toUpperCase();
      const exitSignal =
        iExitSignal == null ? '' : String(row[iExitSignal] || '').toUpperCase();
      if (entryExec) {
        events.push({
          kind: 'open',
          time: entryExec,
          tradeType,
          signal: entrySignal
        });
      }
      if (exitExec) {
        events.push({
          kind: 'close',
          time: exitExec,
          tradeType,
          signal: exitSignal
        });
      }
    }
    byTicker.set(ticker, normalizeTradeMarkers(events.map(markerFromTradeEvent)));
  }
  return byTicker;
}
