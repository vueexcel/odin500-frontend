import { Children, cloneElement, isValidElement } from 'react';
import { useTickerPlotResize } from '../hooks/useTickerPlotResize.js';

/**
 * Wraps a ticker returns chart block: drag the bottom handle to change plot height; persisted per `storageKey`.
 * Injects `plotHeight` into the single child via `cloneElement`.
 * @param {{ storageKey: string, defaultHeight: number, min?: number, max?: number, className?: string, children: import('react').ReactElement }} props
 */
export function TickerChartResizeScope({ storageKey, defaultHeight, min, max, className = '', children }) {
  const { plotHeight, onPointerDown, onDoubleClick, ariaMin, ariaMax, ariaNow } = useTickerPlotResize(
    storageKey,
    defaultHeight,
    min,
    max
  );

  const childEl = Children.only(children);
  const withPlot = isValidElement(childEl) ? cloneElement(childEl, { plotHeight }) : childEl;

  return (
    <div
      className={'ticker-chart-resize-scope ' + className}
      style={{ '--ticker-resize-plot-h': `${plotHeight ?? defaultHeight}px` }}
    >
      {withPlot}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-valuemin={ariaMin}
        aria-valuemax={ariaMax}
        aria-valuenow={ariaNow}
        className="ticker-chart-resize ticker-chart-resize--scope"
        title="Drag to resize chart height. Double-click to reset."
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}
