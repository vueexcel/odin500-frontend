import { createPortal } from 'react-dom';

/**
 * Preview + download modal for chart PNG exports (shared np-export-modal styles).
 * @param {{
 *   open: boolean,
 *   status: 'idle' | 'capturing' | 'ready' | 'error',
 *   error?: string,
 *   previewUrl?: string | null,
 *   onClose: () => void,
 *   onDownload: () => void,
 *   title?: string,
 *   titleId?: string,
 *   previewAlt?: string,
 * }} props
 */
export function ChartSnapshotExportModal({
  open,
  status,
  error = '',
  previewUrl = null,
  onClose,
  onDownload,
  title = 'Export chart',
  titleId = 'chart-export-modal-title',
  previewAlt = 'Exported chart'
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="np-export-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="np-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="np-export-modal__head">
          <h2 id={titleId} className="np-export-modal__title">
            {title}
          </h2>
          <button type="button" className="np-export-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="np-export-modal__body">
          {status === 'capturing' ? <div className="np-export-modal__status">Generating preview…</div> : null}
          {status === 'error' ? (
            <div className="np-export-modal__status np-export-modal__status--error" role="alert">
              {error || 'Something went wrong.'}
            </div>
          ) : null}
          {previewUrl ? (
            <div className="np-export-modal__preview-wrap">
              <img src={previewUrl} alt={previewAlt} className="np-export-modal__preview" />
            </div>
          ) : null}
        </div>
        <div className="np-export-modal__foot">
          <button type="button" className="np-export-modal__btn np-export-modal__btn--ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="np-export-modal__btn np-export-modal__btn--primary"
            onClick={onDownload}
            disabled={!previewUrl}
          >
            Download
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
