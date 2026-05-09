import { useMemo } from 'react';

const DEFAULT_SIBLING_COUNT = 1;

function IconChevronLeft({ double = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {double ? (
        <>
          <path d="M8.8 3.2L5 7l3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.8 3.2L2 7l3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <path d="M8.7 3.2L4.9 7l3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function IconChevronRight({ double = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {double ? (
        <>
          <path d="M5.2 3.2L9 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.2 3.2L12 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <path d="M5.3 3.2L9.1 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function buildPaginationItems(totalPages, currentPage, siblingCount = DEFAULT_SIBLING_COUNT) {
  if (totalPages <= 1) return [1];
  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < totalPages - 1;

  if (!showLeftDots && showRightDots) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1);
    return [...leftRange, 'dots-right', totalPages];
  }
  if (showLeftDots && !showRightDots) {
    const rightRangeStart = totalPages - (2 + siblingCount * 2);
    const rightRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => rightRangeStart + i);
    return [1, 'dots-left', ...rightRange];
  }
  const middle = [];
  for (let p = leftSibling; p <= rightSibling; p += 1) middle.push(p);
  return [1, 'dots-left', ...middle, 'dots-right', totalPages];
}

/**
 * Figma-style pager (first / prev / numbered pages / next / last).
 */
export function FigmaPagination({
  page,
  totalPages,
  onPageChange,
  ariaLabel = 'Pagination',
  siblingCount = DEFAULT_SIBLING_COUNT
}) {
  const items = useMemo(
    () => buildPaginationItems(totalPages, page, siblingCount),
    [totalPages, page, siblingCount]
  );
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div className="statistic-data__pager-figma" role="navigation" aria-label={ariaLabel}>
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="First page"
        onClick={() => onPageChange(1)}
        disabled={!canPrev}
      >
        <IconChevronLeft double />
      </button>
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev}
      >
        <IconChevronLeft />
      </button>
      {items.map((it, idx) =>
        typeof it === 'number' ? (
          <button
            key={`p-${it}`}
            type="button"
            className={'statistic-data__pg-btn' + (it === page ? ' statistic-data__pg-btn--active' : '')}
            aria-label={`Page ${it}`}
            aria-current={it === page ? 'page' : undefined}
            onClick={() => onPageChange(it)}
          >
            {it}
          </button>
        ) : (
          <span key={`${it}-${idx}`} className="statistic-data__pg-dots" aria-hidden>
            ...
          </span>
        )
      )}
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext}
      >
        <IconChevronRight />
      </button>
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="Last page"
        onClick={() => onPageChange(totalPages)}
        disabled={!canNext}
      >
        <IconChevronRight double />
      </button>
    </div>
  );
}
