import { useCallback, useEffect, useId, useState } from 'react';
import { Upload } from 'lucide-react';
import { ChartFullscreenToggleIcon } from './ChartFullscreenToggleIcon.jsx';
import { ChartSnapshotExportModal } from './ChartSnapshotExportModal.jsx';
import { applyTickerChartSnapshotCloneFixes, useChartSnapshotExport } from '../hooks/useChartSnapshotExport.js';
import { notifyChartFullscreenLayout } from '../utils/chartFullscreenLayout.js';

/**
 * @param {import('react').RefObject<HTMLElement | null>} targetRef
 */
export function useChartFullscreen(targetRef) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const el = targetRef.current;
      const doc = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document);
      const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement;
      const next = Boolean(el && fsEl === el);
      setIsFullscreen(next);
      notifyChartFullscreenLayout();
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [targetRef]);

  const toggleFullscreen = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return;
    const doc = /** @type {Document & { webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenElement?: Element | null }} */ (
      document
    );
    const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement;
    try {
      if (fsEl === el) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else doc.webkitExitFullscreen?.();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else {
        /** @type {{ webkitRequestFullscreen?: () => void }} */
        (el).webkitRequestFullscreen?.();
      }
    } catch {
      /* ignore */
    }
    notifyChartFullscreenLayout();
  }, [targetRef]);

  return { isFullscreen, toggleFullscreen };
}

/**
 * Export + fullscreen icon buttons for chart sections (toolbar / title row).
 * @param {{
 *   snapshotRootRef: import('react').RefObject<HTMLElement | null>,
 *   plotHostRef: import('react').RefObject<HTMLElement | null>,
 *   fullscreenTargetRef?: import('react').RefObject<HTMLElement | null>,
 *   buildFilename: () => string,
 *   disabled?: boolean,
 *   onclone?: (clonedDoc: Document, clonedRoot: HTMLElement) => void,
 *   getBackgroundColor?: (isLight: boolean) => string,
 *   getFallbackCanvas?: () => HTMLCanvasElement | null,
 *   className?: string,
 *   exportPreviewAlt?: string,
 *   exportModalTitle?: string,
 * }} props
 */
export function ChartSectionIconActions({
  snapshotRootRef,
  plotHostRef,
  fullscreenTargetRef,
  buildFilename,
  disabled = false,
  onclone,
  getBackgroundColor,
  getFallbackCanvas,
  className = '',
  exportPreviewAlt = 'Exported chart',
  exportModalTitle = 'Export chart'
}) {
  const titleId = useId().replace(/:/g, '');
  const fsRef = fullscreenTargetRef || snapshotRootRef;
  const { isFullscreen, toggleFullscreen } = useChartFullscreen(fsRef);

  const {
    exportingSnapshot,
    exportModalOpen,
    exportModalStatus,
    exportPreviewUrl,
    exportModalError,
    openExportModal,
    closeExportModal,
    downloadFromExportModal
  } = useChartSnapshotExport({
    snapshotRootRef,
    plotHostRef,
    buildFilename,
    disabled,
    getBackgroundColor,
    getFallbackCanvas,
    onclone: onclone || applyTickerChartSnapshotCloneFixes
  });

  return (
    <>
      <div className={'chart-section-icon-actions ' + (className || '').trim()}>
        <button
          type="button"
          className="ticker-chart-footer-icons__btn"
          onClick={openExportModal}
          disabled={disabled || exportingSnapshot}
          aria-label={exportingSnapshot ? 'Exporting chart' : 'Export chart snapshot'}
          title={exportingSnapshot ? 'Exporting…' : 'Export chart'}
        >
          <Upload size={16} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className="ticker-chart-footer-icons__btn"
          onClick={toggleFullscreen}
          aria-pressed={isFullscreen}
          aria-label={isFullscreen ? 'Exit chart fullscreen' : 'Enter chart fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <ChartFullscreenToggleIcon isFullscreen={isFullscreen} />
        </button>
      </div>
      <ChartSnapshotExportModal
        open={exportModalOpen}
        status={exportModalStatus}
        error={exportModalError}
        previewUrl={exportPreviewUrl}
        onClose={closeExportModal}
        onDownload={downloadFromExportModal}
        title={exportModalTitle}
        titleId={titleId}
        previewAlt={exportPreviewAlt}
      />
    </>
  );
}
