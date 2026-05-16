import { ThemedDropdown } from './ThemedDropdown.jsx';
import { ReturnsChartToolbar } from './ReturnsChartToolbar.jsx';
import { ChartSectionIconActions } from './ChartSectionIconActions.jsx';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';

/**
 * Inline toolbar for stats comparison charts: range controls, benchmark, table/download icons, export/fullscreen.
 * Parent must attach `sectionRef` to the chart `<section>` and `plotHostRef` to the plot wrapper (legend + svg).
 */
export function StatsCmpChartToolbarHead({
  sectionRef,
  plotHostRef,
  controls = null,
  benchmarkIndex,
  benchmarkOptions = [],
  onBenchmarkChange = () => {},
  showDataTable = false,
  onToggleDataTable,
  onDownloadCsv,
  csvDisabled = false,
  exportDisabled = false,
  exportChartSlug = 'stats-chart',
  exportSymbol = '',
  exportPreviewAlt = 'Exported chart'
}) {
  const benchmarkDd = (
    <ThemedDropdown
      size="sm"
      className="stats-cmp-chart__benchmark-dd"
      value={benchmarkIndex}
      options={benchmarkOptions}
      onChange={onBenchmarkChange}
      title="Benchmark"
      ariaLabelPrefix="Benchmark"
      labelFallback={benchmarkIndex}
      wideLabel
    />
  );

  const buildFilename = () => buildTickerChartExportFilename(exportChartSlug, exportSymbol);

  return (
    <div className="stats-cmp-chart__head stats-cmp-chart__head--toolbar">
      <ReturnsChartToolbar
        className="stats-cmp-chart__returns-toolbar"
        rangeControls={controls}
        extraActions={benchmarkDd}
        showViewMore={false}
        onToggleTable={onToggleDataTable}
        showTable={showDataTable}
        showTableToggle={typeof onToggleDataTable === 'function'}
        onDownload={onDownloadCsv}
        downloadDisabled={csvDisabled}
        showDownload={typeof onDownloadCsv === 'function'}
      />
      <ChartSectionIconActions
        className="stats-cmp-chart__section-icons"
        snapshotRootRef={sectionRef}
        plotHostRef={plotHostRef}
        fullscreenTargetRef={sectionRef}
        buildFilename={buildFilename}
        disabled={exportDisabled}
        exportPreviewAlt={exportPreviewAlt}
      />
    </div>
  );
}
