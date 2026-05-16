/**
 * Section title that triggers the same action as ReturnsChartToolbar “View more”.
 * Uses a native button with the title’s existing classNames so visuals stay unchanged.
 * @param {{ className?: string, onClick?: () => void, children: import('react').ReactNode, disabled?: boolean }} props
 */
export function ReturnsChartClickableTitle({ className = '', onClick, children, disabled = false }) {
  if (typeof onClick !== 'function' || disabled) {
    return <span className={className || undefined}>{children}</span>;
  }
  return (
    <button type="button" className={'returns-chart-title-btn' + (className ? ` ${className}` : '')} onClick={onClick} aria-label="View more">
      {children}
    </button>
  );
}

/**
 * Heading variant — keeps `h3` markup and classes; adds click + keyboard support.
 * @param {{ className?: string, onClick?: () => void, children: import('react').ReactNode, id?: string }} props
 */
export function ReturnsChartClickableHeading({ className = '', onClick, children, id }) {
  if (typeof onClick !== 'function') {
    return (
      <h3 id={id} className={className || undefined}>
        {children}
      </h3>
    );
  }
  return (
    <h3
      id={id}
      className={(className ? `${className} ` : '') + 'returns-chart-title-heading'}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="View more"
    >
      {children}
    </h3>
  );
}
