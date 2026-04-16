import { DataInfoTip } from './DataInfoTip.jsx';

export function ChartInfoTip({ tip, align = 'end' }) {
  if (!tip) return null;
  return (
    <DataInfoTip align={align}>
      <p className="ticker-data-tip__p">{tip.data}</p>
      <p className="ticker-data-tip__p">{tip.calculation}</p>
      <p className="ticker-data-tip__p">{tip.example}</p>
    </DataInfoTip>
  );
}
