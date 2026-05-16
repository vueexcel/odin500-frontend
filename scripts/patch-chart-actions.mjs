import fs from 'fs';

function patchMonthly() {
  const p = 'src/components/TickerMonthlyReturnsChart.jsx';
  let m = fs.readFileSync(p, 'utf8');
  if (!m.includes('return (\n    <div className="ticker-monthly">\n      <motion ref={sectionRef}')) {
    m = m.replace(
      '  return (\n    <div className="ticker-monthly">\n      <div className="ticker-annual-figma__section">',
      '  return (\n    <div className="ticker-monthly">\n      <div ref={sectionRef} className="ticker-annual-figma__section">'
    );
  }
  const hrOld = `          <div className="ticker-monthly__head-right">
            <ReturnsChartToolbar
              className="ticker-monthly__toolbar min-w-0"
              rangeControls={monthlyRangeControls}
              showViewMore={false}
              onToggleTable={() => setShowTable((v) => !v)}
              showTable={showTable}
              onDownload={onDownloadCsv}
              downloadDisabled={!selectedYearRows.length}
              extraActions={monthlyExtraActions}
            />
          </div>`;
  const hrNew = `          <div className="ticker-monthly__head-right">
            <ReturnsChartToolbar
              className="ticker-monthly__toolbar min-w-0"
              rangeControls={monthlyRangeControls}
              showViewMore={false}
              onToggleTable={() => setShowTable((v) => !v)}
              showTable={showTable}
              onDownload={onDownloadCsv}
              downloadDisabled={!selectedYearRows.length}
              extraActions={monthlyExtraActions}
            />
            <ChartSectionIconActions
              snapshotRootRef={sectionRef}
              plotHostRef={chartCardRef}
              fullscreenTargetRef={sectionRef}
              buildFilename={buildExportFilename}
              disabled={chartExportDisabled}
              exportPreviewAlt={\`\${periodMode} returns chart for \${symU}\`}
            />
          </div>`;
  if (m.includes(hrOld) && !m.includes('chartExportDisabled')) {
    m = m.replace(hrOld, hrNew);
  }
  if (m.includes('<div className="ticker-annual-figma__chart-card">') && !m.includes('ref={chartCardRef} className="ticker-annual-figma__chart-card">')) {
    m = m.replace(
      '        <motion className="ticker-annual-figma__chart-card">',
      '        <div ref={chartCardRef} className="ticker-annual-figma__chart-card">'
    );
    m = m.replace('        <div className="ticker-annual-figma__chart-card">', '        <div ref={chartCardRef} className="ticker-annual-figma__chart-card">');
  }
  if (!m.includes('ref={chartCardRef} className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty"')) {
    m = m.replace(
      '<div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">',
      '<motion ref={chartCardRef} className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">'
    );
  }
  m = m.replace(/<motion/g, '<motion').replace(/<\/motion>/g, '</motion>');
  m = m.replace(/<motion/g, '<div').replace(/<\/motion>/g, '</div>');
  fs.writeFileSync(p, m);
  console.log('monthly ok');
}

patchMonthly();
