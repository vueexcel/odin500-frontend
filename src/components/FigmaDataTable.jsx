import React from 'react';

function SortHeaderIcon({ active, dir }) {
  if (!active) {
    return (
      <svg
        className="figma-data-table__sort-icon figma-data-table__sort-icon--neutral"
        width="11"
        height="12"
        viewBox="0 0 11 12"
        fill="none"
        aria-hidden
      >
        <path d="M5.5 1.5L8.25 4.25H2.75L5.5 1.5Z" fill="currentColor" opacity="0.45" />
        <path d="M5.5 10.5L2.75 7.75H8.25L5.5 10.5Z" fill="currentColor" opacity="0.45" />
      </svg>
    );
  }
  if (dir === 'asc') {
    return (
      <svg
        className="figma-data-table__sort-icon figma-data-table__sort-icon--active"
        width="11"
        height="12"
        viewBox="0 0 11 12"
        fill="none"
        aria-hidden
      >
        <path d="M5.5 2.5L9 7H2L5.5 2.5Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      className="figma-data-table__sort-icon figma-data-table__sort-icon--active"
      width="11"
      height="12"
      viewBox="0 0 11 12"
      fill="none"
      aria-hidden
    >
      <path d="M5.5 9.5L2 5H9L5.5 9.5Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Generic table component with configurable headers and rows.
 * - `headers`: [{ key, label, align?: 'left' | 'center' | 'right', className?: string }]
 * - `rows`: array of objects keyed by header `key`
 * - `renderCell`: optional custom cell renderer
 * - `cellClassName`: optional per-cell class resolver
 * - Optional sort: pass `sortKey`, `sortDir`, and `onSortHeader` to render sortable headers with icons (styling matches plain headers).
 * - `compactHeader` (default `true`): short ~20px header row; styles live in `index.css` under `.figma-data-table__wrap--compact-header`.
 */
export function FigmaDataTable({
  headers,
  rows,
  getRowKey,
  getRowClassName,
  emptyText = 'No rows yet.',
  emptyColSpan,
  renderCell,
  cellClassName,
  wrapClassName = '',
  tableAriaBusy,
  tableAriaLabel,
  sortKey = null,
  sortDir = 'asc',
  onSortHeader,
  compactHeader = true
}) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const span = Number.isFinite(Number(emptyColSpan)) ? Number(emptyColSpan) : Math.max(1, safeHeaders.length);
  const sortable = typeof onSortHeader === 'function';

  const wrapClasses = [
    'figma-data-table__wrap',
    compactHeader ? 'figma-data-table__wrap--compact-header' : '',
    wrapClassName
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClasses}>
      <table className="figma-data-table" aria-busy={tableAriaBusy} aria-label={tableAriaLabel}>
        <thead>
          <tr>
            {safeHeaders.map((header) => {
              const alignClass = header.align ? `figma-data-table__align--${header.align}` : '';
              const thClass = `${header.className || ''} ${alignClass}`.trim();
              const active = sortable && sortKey === header.key;
              const ariaSort = !sortable ? undefined : active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

              if (sortable) {
                return (
                  <th key={header.key} className={thClass || undefined} scope="col" aria-sort={ariaSort}>
                    <button
                      type="button"
                      className={
                        'figma-data-table__sort-btn' + (active ? ' figma-data-table__sort-btn--active' : '')
                      }
                      aria-label={`Sort by ${header.label}`}
                      onClick={() => onSortHeader(header.key)}
                    >
                      <span className="figma-data-table__sort-label">{header.label}</span>
                      <SortHeaderIcon active={active} dir={sortDir} />
                    </button>
                  </th>
                );
              }

              return (
                <th key={header.key} className={thClass || undefined} scope="col">
                  {header.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {safeRows.length ? (
            safeRows.map((row, rowIndex) => (
              <tr
                key={getRowKey ? getRowKey(row, rowIndex) : rowIndex}
                className={getRowClassName ? getRowClassName(row, rowIndex) : undefined}
              >
                {safeHeaders.map((header) => {
                  const content = renderCell ? renderCell({ header, row, rowIndex }) : row?.[header.key];
                  const resolvedClass = cellClassName ? cellClassName({ header, row, rowIndex }) : '';
                  return (
                    <td
                      key={`${String(header.key)}-${rowIndex}`}
                      className={`${resolvedClass || ''} ${header.align ? `figma-data-table__align--${header.align}` : ''}`.trim()}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={span} className="figma-data-table__empty">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
