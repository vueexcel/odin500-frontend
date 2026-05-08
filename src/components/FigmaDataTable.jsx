import React from 'react';

/**
 * Generic table component with configurable headers and rows.
 * - `headers`: [{ key, label, align?: 'left' | 'center' | 'right', className?: string }]
 * - `rows`: array of objects keyed by header `key`
 * - `renderCell`: optional custom cell renderer
 * - `cellClassName`: optional per-cell class resolver
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
  tableAriaLabel
}) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const span = Number.isFinite(Number(emptyColSpan)) ? Number(emptyColSpan) : Math.max(1, safeHeaders.length);

  return (
    <div className={`figma-data-table__wrap ${wrapClassName}`.trim()}>
      <table className="figma-data-table" aria-busy={tableAriaBusy} aria-label={tableAriaLabel}>
        <thead>
          <tr>
            {safeHeaders.map((header) => (
              <th
                key={header.key}
                className={`${header.className || ''} ${header.align ? `figma-data-table__align--${header.align}` : ''}`.trim()}
              >
                {header.label}
              </th>
            ))}
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

