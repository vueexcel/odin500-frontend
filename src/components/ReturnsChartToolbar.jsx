import { useCallback } from 'react';
import { useLoginGateOptional } from '../context/LoginGateContext.jsx';
import { useIsLoggedIn } from '../hooks/useIsLoggedIn.js';
import {
  ReturnsChartIcoDownload,
  ReturnsChartIcoTable,
  ReturnsChartIcoViewMore
} from './returnsChartToolbarIcons.jsx';

/**
 * Icon action with native `title` tooltip on hover.
 * @param {{ label: string, onClick?: () => void, children: import('react').ReactNode, active?: boolean, disabled?: boolean }} props
 */
export function ReturnsChartToolbarIconButton({ label, onClick, children, active = false, disabled = false }) {
  return (
    <button
      type="button"
      className={'returns-chart-toolbar__icon-btn' + (active ? ' returns-chart-toolbar__icon-btn--active' : '')}
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/**
 * Inline returns chart toolbar: optional range controls + icon actions (no filters dropdown).
 * @param {{
 *   rangeControls?: import('react').ReactNode,
 *   onViewMore?: () => void,
 *   onToggleTable?: () => void,
 *   showTable?: boolean,
 *   onDownload?: () => void,
 *   downloadDisabled?: boolean,
 *   showViewMore?: boolean,
 *   showTableToggle?: boolean,
 *   showDownload?: boolean,
 *   extraActions?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function ReturnsChartToolbar({
  rangeControls = null,
  onViewMore,
  onToggleTable,
  showTable = false,
  onDownload,
  downloadDisabled = false,
  showViewMore = true,
  showTableToggle = true,
  showDownload = true,
  extraActions = null,
  className = ''
}) {
  const loggedIn = useIsLoggedIn();
  const loginGate = useLoginGateOptional();

  const handleDownload = useCallback(() => {
    if (downloadDisabled) return;
    if (!loggedIn) {
      loginGate?.showLoginRequired();
      return;
    }
    onDownload?.();
  }, [downloadDisabled, loggedIn, loginGate, onDownload]);

  return (
    <div className={'returns-chart-toolbar ' + (className || '').trim()}>
      {rangeControls ? <div className="returns-chart-toolbar__range">{rangeControls}</div> : null}
      <div className="returns-chart-toolbar__actions">
        {showViewMore && typeof onViewMore === 'function' ? (
          <ReturnsChartToolbarIconButton label="View more" onClick={onViewMore}>
            <ReturnsChartIcoViewMore />
          </ReturnsChartToolbarIconButton>
        ) : null}
        {extraActions}
        {showTableToggle && typeof onToggleTable === 'function' ? (
          <ReturnsChartToolbarIconButton
            label={showTable ? 'Hide data table' : 'Show data table'}
            onClick={onToggleTable}
            active={showTable}
          >
            <ReturnsChartIcoTable />
          </ReturnsChartToolbarIconButton>
        ) : null}
        {showDownload && typeof onDownload === 'function' ? (
          <ReturnsChartToolbarIconButton
            label={loggedIn ? 'Download CSV' : 'Sign in to download CSV'}
            onClick={handleDownload}
            disabled={downloadDisabled}
          >
            <ReturnsChartIcoDownload />
          </ReturnsChartToolbarIconButton>
        ) : null}
      </div>
    </div>
  );
}
