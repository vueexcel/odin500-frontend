import { useCallback, useState } from 'react';

/**
 * Start / end date inputs + Submit (+ Clear) for client-side chart filtering.
 * @param {{ idPrefix: string, maxDate?: string, onApply: (r: { start: string, end: string }) => void }} props
 */
export function ChartDateApplyRow({ idPrefix, maxDate, onApply }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const submit = useCallback(() => {
    let s = String(start || '').trim().slice(0, 10);
    let e = String(end || '').trim().slice(0, 10);
    const cap = maxDate ? String(maxDate).slice(0, 10) : '';
    if (s && cap && s > cap) s = cap;
    if (e && cap && e > cap) e = cap;
    if (s && e && s > e) {
      const t = s;
      s = e;
      e = t;
    }
    onApply({ start: s, end: e });
  }, [start, end, maxDate, onApply]);

  const clear = useCallback(() => {
    setStart('');
    setEnd('');
    onApply({ start: '', end: '' });
  }, [onApply]);

  const max = maxDate ? String(maxDate).slice(0, 10) : undefined;

  return (
    <div className="chart-date-apply">
      <span className="ticker-page__label ticker-page__label--inline">Start date</span>
      <input
        id={idPrefix + '-start'}
        type="date"
        className="ticker-page__date-inp"
        value={start}
        onChange={(ev) => setStart(ev.target.value)}
        max={end || max}
      />
      <span className="ticker-page__label ticker-page__label--inline">End date</span>
      <input
        id={idPrefix + '-end'}
        type="date"
        className="ticker-page__date-inp"
        value={end}
        onChange={(ev) => setEnd(ev.target.value)}
        min={start || undefined}
        max={max}
      />
      <button type="button" className="ticker-outline-btn ticker-outline-btn--sm" onClick={submit}>
        Submit
      </button>
      <button type="button" className="ticker-outline-btn ticker-outline-btn--sm" onClick={clear}>
        Clear
      </button>
    </div>
  );
}
