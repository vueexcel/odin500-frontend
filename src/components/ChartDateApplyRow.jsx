import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Start / end date inputs + Submit (+ Clear) for client-side chart filtering.
 * @param {{
 *   idPrefix: string,
 *   maxDate?: string,
 *   onApply: (r: { start: string, end: string }) => void,
 *   mode?: 'date' | 'year',
 *   minYear?: number,
 *   maxYear?: number,
 *   initialStart?: string,
 *   initialEnd?: string
 * }} props
 */
export function ChartDateApplyRow({
  idPrefix,
  maxDate,
  onApply,
  mode = 'date',
  minYear = 1980,
  maxYear = 2026,
  initialStart = '',
  initialEnd = ''
}) {
  const [start, setStart] = useState(String(initialStart || ''));
  const [end, setEnd] = useState(String(initialEnd || ''));
  const lastAppliedRef = useRef({ start: null, end: null });

  const normalizedMinYear = Number.isFinite(Number(minYear)) ? Math.floor(Number(minYear)) : 1980;
  const normalizedMaxYear = Number.isFinite(Number(maxYear)) ? Math.floor(Number(maxYear)) : 2026;
  const yearLo = Math.min(normalizedMinYear, normalizedMaxYear);
  const yearHi = Math.max(normalizedMinYear, normalizedMaxYear);
  const years = [];
  for (let y = yearHi; y >= yearLo; y -= 1) years.push(String(y));

  const applyRange = useCallback(
    (startVal, endVal) => {
      const startRaw = String(startVal || '').trim();
      const endRaw = String(endVal || '').trim();
      let s = startRaw ? (mode === 'year' ? `${startRaw.slice(0, 4)}-01-01` : startRaw.slice(0, 10)) : '';
      let e = endRaw ? (mode === 'year' ? `${endRaw.slice(0, 4)}-12-31` : endRaw.slice(0, 10)) : '';
      const cap = maxDate ? String(maxDate).slice(0, 10) : '';
      if (s && cap && s > cap) s = cap;
      if (e && cap && e > cap) e = cap;
      if (s && e && s > e) {
        const t = s;
        s = e;
        e = t;
      }
      // Avoid feedback loops when parent passes a new onApply identity each render.
      // Only emit when the normalized values actually changed.
      if (lastAppliedRef.current.start === s && lastAppliedRef.current.end === e) return;
      lastAppliedRef.current = { start: s, end: e };
      onApply({ start: s, end: e });
    },
    [maxDate, mode, onApply]
  );

  const submit = useCallback(() => {
    applyRange(start, end);
  }, [applyRange, start, end]);

  const clear = useCallback(() => {
    setStart('');
    setEnd('');
    lastAppliedRef.current = { start: '', end: '' };
    onApply({ start: '', end: '' });
  }, [onApply]);

  useEffect(() => {
    setStart(String(initialStart || ''));
    setEnd(String(initialEnd || ''));
  }, [idPrefix, initialStart, initialEnd]);

  useEffect(() => {
    if (mode !== 'year') return;
    applyRange(start, end);
  }, [mode, start, end, applyRange]);

  const max = maxDate ? String(maxDate).slice(0, 10) : undefined;

  return (
    <div className="chart-date-apply">
      <span className="ticker-page__label ticker-page__label--inline">{mode === 'year' ? 'Start year' : 'Start date'}</span>
      {mode === 'year' ? (
        <select
          id={idPrefix + '-start-year'}
          className="ticker-page__date-inp"
          value={start}
          onChange={(ev) => setStart(ev.target.value)}
        >
          <option value="">All</option>
          {years.map((y) => (
            <option key={idPrefix + '-start-opt-' + y} value={y}>
              {y}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={idPrefix + '-start'}
          type="date"
          className="ticker-page__date-inp"
          value={start}
          onChange={(ev) => setStart(ev.target.value)}
          max={end || max}
        />
      )}
      <span className="ticker-page__label ticker-page__label--inline">{mode === 'year' ? 'End year' : 'End date'}</span>
      {mode === 'year' ? (
        <select
          id={idPrefix + '-end-year'}
          className="ticker-page__date-inp"
          value={end}
          onChange={(ev) => setEnd(ev.target.value)}
        >
          <option value="">All</option>
          {years.map((y) => (
            <option key={idPrefix + '-end-opt-' + y} value={y}>
              {y}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={idPrefix + '-end'}
          type="date"
          className="ticker-page__date-inp"
          value={end}
          onChange={(ev) => setEnd(ev.target.value)}
          min={start || undefined}
          max={max}
        />
      )}
      <button type="button" className="ticker-outline-btn ticker-outline-btn--sm" onClick={submit}>
        Submit
      </button>
      <button type="button" className="ticker-outline-btn ticker-outline-btn--sm" onClick={clear}>
        Clear
      </button>
    </div>
  );
}
