/** Notify SVG / lightweight-charts listeners to remeasure after fullscreen transitions. */
export function notifyChartFullscreenLayout() {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new CustomEvent('odin-chart-layout'));
  });
}
