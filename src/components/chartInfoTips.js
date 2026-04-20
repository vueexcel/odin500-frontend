export const CHART_INFO_TIPS = {
  normalizedPerformance: {
    data: 'Data shown: normalized % return series for selected indices over the active timeframe.',
    calculation:
      'Calculation: each row uses close-to-close return from /api/market/ohlc-signals-indicator, normalized to percent change from the first point in range.',
    example:
      'Example: if SPX starts at 5000 and later closes at 5250, chart value is +5.00%. If it drops to 4900, value is -2.00%.'
  },
  marketIndexReturns: {
    data: 'Data shown: index return heat table for S&P 500, Dow Jones, and Nasdaq-100 across 1D, 1M, 6M, and 1Y.',
    calculation:
      'Calculation: each cell is range return % from /api/market/ohlc-signals-indicator using (lastClose - firstClose) / firstClose * 100 for that timeframe.',
    example:
      'Example: first close 100, last close 108 -> +8.0% cell value.'
  },
  marketHeatmapThumb: {
    data: 'Data shown: mini treemap for the selected index snapshot, using latest ticker rows from /api/market/ticker-details.',
    calculation:
      'Calculation: tile color maps totalReturnPercentage to the heat scale; tile area is weighted by market-cap proxy logic from the treemap component.',
    example:
      'Example: a ticker at -2.3% is colored red/orange, while +1.7% is green.'
  },
  tickerRelativeStrength: {
    data: 'Data shown: compact relative-strength table for key periods (1D to YTD) and diff bars vs SPY.',
    calculation:
      'Calculation: table uses period return %; bar chart uses diff = symbolReturn - benchmarkReturn for the same row.',
    example:
      'Example: symbol +3.2%, benchmark +1.1% -> diff bar is +2.1%.'
  },
  tickerCompareBars: {
    data: 'Data shown: side-by-side benchmark vs ticker total return bars across 1D to 20Y.',
    calculation:
      'Calculation: values are pulled from dynamicPeriods and plotted on a shared Y axis so each timeframe compares the same scale.',
    example:
      'Example: benchmark 10.0% and ticker 14.5% on 1Y -> ticker bar appears higher by 4.5 pts.'
  },
  tickerAnnualReturns: {
    data: 'Data shown: annual total return % for each calendar year in the ticker returns payload.',
    calculation:
      'Calculation: each annual bar uses totalReturn from performance.annualReturns for that year; average line is arithmetic mean of plotted yearly returns.',
    example:
      'Example: years [+12%, -4%, +8%] produce average line at +5.33%.'
  },
  tickerAnnualStats: {
    data: 'Data shown: annual stats split (positive vs negative year counts) and summary bars (max, min, average, median).',
    calculation:
      'Calculation: counts come from sign of annual totalReturn; stats are computed over the same annual return set currently filtered by date range.',
    example:
      'Example: annual returns [10, -6, 4] -> positive years 2, negative years 1, max 10, min -6, average 2.67.'
  },
  heatmapTreemap: {
    data: 'Data shown: market treemap of symbols for the selected index and period.',
    calculation:
      'Calculation: tile fill uses totalReturnPercentage mapped to the current ±scale slider; treemap grouping/size follows sector and weight logic in SectorTreemap.',
    example:
      'Example: changing scale from ±3% to ±10% compresses colors so small moves appear less saturated.'
  },
  odinOmxGauge: {
    data: 'Data shown: OMX gauge with a 0-100 weighted sentiment score for the selected index list.',
    calculation:
      'Calculation: each ticker contributes one signal bucket (L1/L2/L3/N/S3/S2/S1) and OMX is the weighted average score: L1=100, L2=83, L3=67, N=50, S3=33, S2=17, S1=0.',
    example:
      'Example: if 50% are S1 (0), 30% are N (50), and 20% are L2 (83), OMX = 0.5*0 + 0.3*50 + 0.2*83 = 31.6 (Bearish).'
  },
  odinDirectionDonut: {
    data: 'Data shown: donut split of Long, Short, and Neutral signal counts.',
    calculation:
      'Calculation: Long = L1+L2+L3, Short = S1+S2+S3, Neutral = N; each slice angle is value / total * 360.',
    example:
      'Example: 60 long, 30 short, 10 neutral -> 60%, 30%, 10% slices.'
  },
  odinSignalDonut: {
    data: 'Data shown: donut split by detailed signal buckets L1/L2/L3/S1/S2/S3/N.',
    calculation:
      'Calculation: each ticker contributes one count to its signal bucket, then each bucket is converted to percent of total.',
    example:
      'Example: if L1=25 out of 100 tickers, L1 slice is 25%.'
  },
  odinSignalTreemap: {
    data: 'Data shown: Odin signal treemap grouped by signal bucket for the active index.',
    calculation:
      'Calculation: tiles are grouped by mapped signal code; color uses the Odin Figma palette and size follows the signal-weight tier configured for this view.',
    example:
      'Example: L1/S1 groups get larger weight than N, so they occupy more area when counts are similar.'
  },
  marketMoversScatter: {
    data:
      'Data shown: one point per ticker in the selected index (S&P 500, Dow Jones, or Nasdaq 100), from POST /api/market/index-market-movers using the current index menu and return-period tab (1D, 5D, MTD, …). The sector filter only limits which points are drawn.',
    calculation:
      'Calculation: the Y axis is total return % for the active return window (same window as the chart title). The X axis is relative volume — latest session volume relative to its 10-day average, as a multiple (×). Labels on some dots mark large price moves or extreme volume; hover any point for symbol, return, and rel. volume. Scroll the plot to zoom, drag to pan.',
    example:
      'Example: a point at +3.1% vertically and 2.0× horizontally is a ticker up ~3.1% over the selected period with about double its typical 10-day volume.'
  }
};
