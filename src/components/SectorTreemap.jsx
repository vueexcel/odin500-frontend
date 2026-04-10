import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { hierarchy, treemap as d3treemap, treemapSquarify } from 'd3-hierarchy';
import { returnToHeatColor } from '../utils/heatmapColors.js';
import { HeatmapIndustryTooltip } from './HeatmapIndustryTooltip.jsx';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function treemapWeight(price) {
  const p = Number(price);
  const base = Number.isFinite(p) && p > 0 ? Math.pow(p, 0.82) : 40;
  return Math.max(base, 6);
}

function formatChangePct(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—';
  const v = Number(pct);
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

/** Sector → Industry → stocks (matches TickerDetails: Sector, Industry columns). */
function buildHierarchy(rows) {
  const bySector = new Map();
  for (const row of rows) {
    const sec = String(row.sector || 'Other').trim() || 'Other';
    const ind = String(row.industry || 'General').trim() || 'General';
    if (!bySector.has(sec)) bySector.set(sec, new Map());
    const byInd = bySector.get(sec);
    if (!byInd.has(ind)) byInd.set(ind, []);
    byInd.get(ind).push(row);
  }

  const children = [];
  for (const [secName, indMap] of bySector) {
    const indChildren = [];
    for (const [indName, stocks] of indMap) {
      if (!stocks.length) continue;
      indChildren.push({
        name: indName,
        children: stocks.map((t) => ({
          name: t.symbol,
          value: treemapWeight(t.price),
          symbol: t.symbol,
          security: t.security || '',
          sector: secName,
          industry: indName,
          changePct: t.totalReturnPercentage,
          price: t.price
        }))
      });
    }
    if (indChildren.length) {
      children.push({ name: secName, children: indChildren });
    }
  }
  return { name: 'root', children };
}

function peersForIndustry(rows, featured) {
  const s = norm(featured.sector);
  const i = norm(featured.industry);
  return rows
    .filter((r) => norm(r.sector) === s && norm(r.industry) === i)
    .map((r) => ({
      symbol: r.symbol,
      security: r.security || '',
      price: r.price,
      changePct: r.totalReturnPercentage,
      weight: treemapWeight(r.price)
    }))
    .sort((a, b) => b.weight - a.weight);
}

function peersForSector(rows, featured) {
  const s = norm(featured.sector);
  return rows
    .filter((r) => norm(r.sector) === s)
    .map((r) => ({
      symbol: r.symbol,
      security: r.security || '',
      price: r.price,
      changePct: r.totalReturnPercentage,
      weight: treemapWeight(r.price)
    }))
    .sort((a, b) => b.weight - a.weight);
}

/** Gap between cursor and tooltip (top-left of card), in px */
const TOOLTIP_CURSOR_GAP_X = 56;
const TOOLTIP_CURSOR_GAP_Y = 54;

function tooltipPosition(clientX, clientY) {
  const w = 340;
  const h = 420;
  let left = clientX + TOOLTIP_CURSOR_GAP_X;
  let top = clientY + TOOLTIP_CURSOR_GAP_Y;
  if (typeof window !== 'undefined') {
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
    left = Math.max(8, left);
    top = Math.max(8, top);
  }
  return { left, top };
}

const LABEL_ON_TILE = '#f8fafc';
const LABEL_ON_TILE_MUTED = 'rgba(248, 250, 252, 0.88)';

const MIN_TILE_SYM_PX = 7;
const MAX_TILE_SYM_PX = 22;

/** Approximate text width for bold UI sans (tickers uppercase; % string mixed). */
function approxLabelWidth(str, fontPx, charFactor) {
  return String(str).length * fontPx * charFactor;
}

/**
 * Figma-style: only render label if ticker + change% fit in two rows; else leave tile empty.
 * Picks the largest font size that fits (down to MIN_TILE_SYM_PX).
 */
function fitTileTwoLine(w, h, sym, pctStr) {
  const padX = 4;
  const padY = 3;
  const gap = 2;
  const symS = String(sym || '');
  const pctS = String(pctStr);
  const startSym = Math.min(
    MAX_TILE_SYM_PX,
    Math.max(MIN_TILE_SYM_PX, Math.floor(Math.min(w, h) * 0.15))
  );

  for (let symPx = startSym; symPx >= MIN_TILE_SYM_PX; symPx--) {
    const pctPx = Math.max(6, Math.round(symPx * 0.82));
    const needW =
      Math.max(
        approxLabelWidth(symS, symPx, 0.62),
        approxLabelWidth(pctS, pctPx, 0.56)
      ) +
      padX * 2;
    const line1H = symPx * 1.15;
    const line2H = pctPx * 1.12;
    const needH = line1H + gap + line2H + padY * 2;
    if (w >= needW && h >= needH) {
      return { symPx, pctPx, line1H, line2H, gap };
    }
  }
  return null;
}

export function SectorTreemap({ rows, scaleMin = -3, scaleMax = 3, highlightSymbol = '' }) {
  const wrapRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setHover(null);
      hideTimerRef.current = null;
    }, 200);
  }, [clearHideTimer]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    const w = Math.floor(el.clientWidth);
    const h = Math.floor(el.clientHeight);
    if (w && h) setSize({ w, h });
    return () => ro.disconnect();
  }, []);

  const layoutRoot = useMemo(() => {
    if (!rows.length || size.w < 40 || size.h < 40) return null;
    const data = buildHierarchy(rows);
    if (!data.children?.length) return null;
    const root = hierarchy(data)
      .sum((d) => (d.children ? 0 : d.value))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    const tm = d3treemap()
      .tile(treemapSquarify)
      .size([size.w, size.h])
      .paddingOuter(3)
      .paddingInner(1)
      .paddingTop((d) => {
        if (d.depth === 1) return 22;
        if (d.depth === 2) return 13;
        return 0;
      })
      .round(true);
    tm(root);
    return root;
  }, [rows, size.w, size.h]);

  const sectorNodes = layoutRoot?.children || [];
  const industryNodes = useMemo(() => {
    if (!layoutRoot) return [];
    const out = [];
    layoutRoot.each((d) => {
      if (d.depth === 2 && d.children) out.push(d);
    });
    return out;
  }, [layoutRoot]);

  const leaves = layoutRoot?.leaves() || [];

  const peerList = useMemo(() => {
    if (!hover?.data || !rows.length) return [];
    const scope = hover.peerScope || 'industry';
    if (scope === 'sector') return peersForSector(rows, hover.data);
    return peersForIndustry(rows, hover.data);
  }, [
    rows,
    hover?.data?.symbol,
    hover?.data?.sector,
    hover?.data?.industry,
    hover?.peerScope
  ]);

  if (!rows.length) {
    return (
      <div className="sector-treemap sector-treemap--empty" ref={wrapRef}>
        <p>No data for this index / period.</p>
      </div>
    );
  }

  if (!layoutRoot) {
    return <div className="sector-treemap sector-treemap--loading" ref={wrapRef} />;
  }

  const tooltipEl =
    hover &&
    typeof document !== 'undefined' &&
    createPortal(
      <HeatmapIndustryTooltip
        left={hover.left}
        top={hover.top}
        featured={hover.data}
        peers={peerList}
        scaleMin={scaleMin}
        scaleMax={scaleMax}
        onMouseEnter={clearHideTimer}
        onMouseLeave={scheduleHide}
      />,
      document.body
    );

  return (
    <div className="sector-treemap sector-treemap--finviz" ref={wrapRef}>
      {tooltipEl}
      <svg
        className="sector-treemap__svg"
        width={size.w}
        height={size.h}
        role="img"
        aria-label="Sector and industry heatmap"
        onMouseLeave={(e) => {
          const t = e.relatedTarget;
          if (t && typeof t.closest === 'function' && t.closest('.heatmap-tooltip')) return;
          scheduleHide();
        }}
      >
        {sectorNodes.map((node) => {
          const sw = node.x1 - node.x0;
          const sh = node.y1 - node.y0;
          const band = Math.min(22, Math.max(14, sh * 0.11));
          if (sw < 24 || sh < 20) return null;
          const sectorFeatured = node
            .leaves()
            .map((l) => l.data)
            .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
          return (
            <g
              key={'sec-band-' + node.data.name}
              onMouseEnter={(e) => {
                if (!sectorFeatured) return;
                clearHideTimer();
                const pos = tooltipPosition(e.clientX, e.clientY);
                setHover({
                  left: pos.left,
                  top: pos.top,
                  data: sectorFeatured,
                  peerScope: 'sector'
                });
              }}
              onMouseMove={(e) => {
                if (!sectorFeatured) return;
                const pos = tooltipPosition(e.clientX, e.clientY);
                setHover((prev) => {
                  if (
                    !prev ||
                    String(prev.data?.symbol) !== String(sectorFeatured.symbol) ||
                    prev.peerScope !== 'sector'
                  ) {
                    return prev;
                  }
                  return { ...prev, left: pos.left, top: pos.top };
                });
              }}
            >
              <rect
                x={node.x0}
                y={node.y0}
                width={sw}
                height={band}
                fill="rgba(10, 15, 26, 0.96)"
                stroke="rgba(30, 41, 59, 0.9)"
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={node.x0 + 8}
                y={node.y0 + band * 0.72}
                className="sector-treemap__sector-title"
                fill="#f8fafc"
                pointerEvents="none"
              >
                {String(node.data.name).toUpperCase()}
              </text>
            </g>
          );
        })}
        {industryNodes.map((node) => {
          const iw = node.x1 - node.x0;
          const ih = node.y1 - node.y0;
          const band = Math.min(14, Math.max(10, ih * 0.09));
          if (iw < 28 || ih < 18) return null;
          const label = String(node.data.name).toUpperCase();
          const maxChars = Math.floor(iw / 6.5);
          const short = label.length > maxChars && maxChars > 6 ? label.slice(0, maxChars - 2) + '…' : label;
          const industryFeatured = node
            .leaves()
            .map((l) => l.data)
            .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
          return (
            <g
              key={'ind-' + node.data.name + '-' + node.x0}
              onMouseEnter={(e) => {
                if (!industryFeatured) return;
                clearHideTimer();
                const pos = tooltipPosition(e.clientX, e.clientY);
                setHover({
                  left: pos.left,
                  top: pos.top,
                  data: industryFeatured,
                  peerScope: 'industry'
                });
              }}
              onMouseMove={(e) => {
                if (!industryFeatured) return;
                const pos = tooltipPosition(e.clientX, e.clientY);
                setHover((prev) => {
                  if (
                    !prev ||
                    String(prev.data?.symbol) !== String(industryFeatured.symbol) ||
                    prev.peerScope !== 'industry'
                  ) {
                    return prev;
                  }
                  return { ...prev, left: pos.left, top: pos.top };
                });
              }}
            >
              <rect
                x={node.x0}
                y={node.y0}
                width={iw}
                height={band}
                fill="rgba(0, 0, 0, 0.42)"
                stroke="rgba(250, 204, 21, 0.15)"
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={node.x0 + 5}
                y={node.y0 + band * 0.72}
                className="sector-treemap__industry-title"
                fill="#fde047"
                pointerEvents="none"
              >
                {short}
              </text>
            </g>
          );
        })}
        {leaves.map((node) => {
          const w = node.x1 - node.x0;
          const h = node.y1 - node.y0;
          const sym = node.data.symbol || node.data.name;
          const pct = node.data.changePct;
          const fill = returnToHeatColor(pct, scaleMin, scaleMax);
          const active = highlightSymbol && String(sym).toUpperCase() === highlightSymbol.toUpperCase();
          const pctStr = formatChangePct(pct);
          const tooltipTitle = `${sym} — ${pctStr}`;
          const labelFit = fitTileTwoLine(w, h, sym, pctStr);
          const blockH = labelFit
            ? labelFit.line1H + labelFit.gap + labelFit.line2H
            : 0;
          const blockTop = labelFit ? node.y0 + (h - blockH) / 2 : 0;
          const ySym = labelFit ? blockTop + labelFit.line1H / 2 : 0;
          const yPct = labelFit
            ? blockTop + labelFit.line1H + labelFit.gap + labelFit.line2H / 2
            : 0;

          return (
            <g
              key={sym + '-' + node.x0 + '-' + node.y0}
              className={'sector-treemap__cell' + (active ? ' sector-treemap__cell--hi' : '')}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                clearHideTimer();
                const pos = tooltipPosition(e.clientX, e.clientY);
                setHover({
                  left: pos.left,
                  top: pos.top,
                  data: node.data,
                  peerScope: 'industry'
                });
              }}
              onMouseMove={(e) => {
                const pos = tooltipPosition(e.clientX, e.clientY);
                setHover((prev) => {
                  if (
                    !prev ||
                    String(prev.data?.symbol) !== String(sym) ||
                    prev.peerScope !== 'industry'
                  ) {
                    return prev;
                  }
                  return { ...prev, left: pos.left, top: pos.top };
                });
              }}
            >
              <title>{tooltipTitle}</title>
              <rect
                x={node.x0}
                y={node.y0}
                width={Math.max(0, w)}
                height={Math.max(0, h)}
                fill={fill}
                stroke="rgba(15, 23, 42, 0.65)"
                strokeWidth={active ? 2 : 1}
                rx={1}
                ry={1}
              />
              {labelFit ? (
                <>
                  <text
                    x={node.x0 + w / 2}
                    y={ySym}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="sector-treemap__tick sector-treemap__tick--finviz"
                    fill={LABEL_ON_TILE}
                    style={{ fontSize: labelFit.symPx }}
                  >
                    {sym}
                  </text>
                  <text
                    x={node.x0 + w / 2}
                    y={yPct}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="sector-treemap__pct sector-treemap__tick--finviz"
                    fill={LABEL_ON_TILE_MUTED}
                    style={{ fontSize: labelFit.pctPx }}
                  >
                    {pctStr}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
