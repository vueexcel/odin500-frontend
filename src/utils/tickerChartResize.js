/** Inline styles so resizable ticker SVGs override global `.ticker-annual-figma__svg` rules (`height: auto`, `max-height`). */
export function tickerSvgPlotStyle(plotHeight) {
  if (plotHeight == null || !Number.isFinite(plotHeight)) return undefined;
  const h = Math.round(plotHeight);
  return {
    height: h,
    maxHeight: 'none',
    minHeight: Math.min(100, h),
    width: '100%',
    display: 'block'
  };
}
