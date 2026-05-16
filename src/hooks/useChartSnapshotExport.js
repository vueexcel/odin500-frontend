import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import html2canvas from 'html2canvas';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';

function defaultTickerChartBg(isLight) {
  return isLight ? '#ffffff' : '#0f172a';
}

/**
 * Capture chart area → preview modal → PNG download (NormalizedPerformanceCard flow).
 * @param {{
 *   snapshotRootRef: import('react').RefObject<HTMLElement | null>,
 *   plotHostRef: import('react').RefObject<HTMLElement | null>,
 *   buildFilename: () => string,
 *   disabled?: boolean,
 *   getBackgroundColor?: (isLight: boolean) => string,
 *   getFallbackCanvas?: () => HTMLCanvasElement | null,
 *   onclone?: (clonedDoc: Document, clonedRoot: HTMLElement) => void,
 * }} opts
 */
export function useChartSnapshotExport({
  snapshotRootRef,
  plotHostRef,
  buildFilename,
  disabled = false,
  getBackgroundColor = defaultTickerChartBg,
  getFallbackCanvas,
  onclone
}) {
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const [exportingSnapshot, setExportingSnapshot] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalStatus, setExportModalStatus] = useState('idle');
  const [exportPreviewUrl, setExportPreviewUrl] = useState(null);
  const [exportFilename, setExportFilename] = useState('');
  const [exportModalError, setExportModalError] = useState('');

  const closeExportModal = useCallback(() => {
    setExportModalOpen(false);
    setExportModalStatus('idle');
    setExportPreviewUrl(null);
    setExportFilename('');
    setExportModalError('');
  }, []);

  const downloadFromExportModal = useCallback(() => {
    if (!exportPreviewUrl || !exportFilename) return;
    const link = document.createElement('a');
    link.href = exportPreviewUrl;
    link.download = exportFilename;
    link.click();
  }, [exportPreviewUrl, exportFilename]);

  const openExportModal = useCallback(async () => {
    const root = snapshotRootRef.current;
    const host = plotHostRef.current;
    if (!host || disabled) return;

    const filename = buildFilename();

    setExportModalOpen(true);
    setExportModalStatus('capturing');
    setExportPreviewUrl(null);
    setExportFilename(filename);
    setExportModalError('');

    const fallbackCanvas = () => {
      if (typeof getFallbackCanvas === 'function') {
        const c = getFallbackCanvas();
        if (c) return c;
      }
      const canvas = host.querySelector('canvas');
      return canvas instanceof HTMLCanvasElement ? canvas : null;
    };

    setExportingSnapshot(true);
    try {
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      let canvas = null;
      if (root) {
        const isLight = chartTheme === 'light';
        let exportBg = getBackgroundColor(isLight);
        if (typeof window !== 'undefined') {
          const c = window.getComputedStyle(root).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') exportBg = c;
        }
        try {
          canvas = await html2canvas(root, {
            backgroundColor: exportBg,
            scale: 1,
            useCORS: true,
            allowTaint: false,
            logging: false,
            foreignObjectRendering: false,
            imageTimeout: 20000,
            onclone: onclone
              ? (clonedDoc, clonedRoot) => {
                  if (clonedRoot instanceof HTMLElement) onclone(clonedDoc, clonedRoot);
                }
              : undefined
          });
        } catch (e) {
          console.warn('[useChartSnapshotExport] html2canvas failed', e);
          canvas = null;
        }
      }

      if (!canvas || canvas.width < 8 || canvas.height < 8) {
        canvas = fallbackCanvas();
      }
      if (!canvas || canvas.width < 8 || canvas.height < 8) {
        setExportModalError('Could not capture the chart. Try again after the chart finishes loading.');
        setExportModalStatus('error');
        return;
      }

      setExportPreviewUrl(canvas.toDataURL('image/png'));
      setExportModalStatus('ready');
    } catch (e) {
      console.warn('[useChartSnapshotExport] capture failed', e);
      setExportModalError(e?.message || 'Capture failed.');
      setExportModalStatus('error');
    } finally {
      setExportingSnapshot(false);
    }
  }, [buildFilename, chartTheme, disabled, getBackgroundColor, getFallbackCanvas, onclone, plotHostRef, snapshotRootRef]);

  useEffect(() => {
    if (!exportModalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeExportModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exportModalOpen, closeExportModal]);

  useEffect(() => {
    if (!exportModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [exportModalOpen]);

  return {
    exportingSnapshot,
    exportModalOpen,
    exportModalStatus,
    exportPreviewUrl,
    exportFilename,
    exportModalError,
    openExportModal,
    closeExportModal,
    downloadFromExportModal
  };
}

/** Hide footer controls in ticker chart snapshots. */
export function applyTickerChartSnapshotCloneFixes(_clonedDoc, clonedRoot) {
  if (!(clonedRoot instanceof HTMLElement)) return;
  clonedRoot
    .querySelectorAll('.ticker-chart-footer-icons, .ticker-chart-resize, .chart-section-icon-actions')
    .forEach((el) => el.remove());
}
