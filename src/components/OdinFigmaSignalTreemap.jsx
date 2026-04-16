import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { hierarchy, treemap as d3treemap, treemapSquarify } from 'd3-hierarchy';
import { HeatmapIndustryTooltip } from './HeatmapIndustryTooltip.jsx';
import {
  figmaFillForSignal,
  ODIN_SIGNAL_GROUP_ORDER,
  resolveOdinSignalTreemapRows
} from '../utils/odinSignalTreemap.js';

function readChangePct(row) {
  const candidates = [
    row.totalReturnPercentage,
    row.total_return_percentage,
    row.changePercent,
    row.change_percentage,
    row.changePct,
    row.percentChange,
    row.pct_change
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function formatChangePct(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—';
  const v = Number(pct);
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

const TOOLTIP_CURSOR_GAP_X = 56;
const TOOLTIP_CURSOR_GAP_Y = 54;
const TOOLTIP_VIEW_MARGIN = 8;

function tooltipPosition(clientX, clientY) {
  if (typeof window === 'undefined') {
    return { left: clientX + TOOLTIP_CURSOR_GAP_X, top: clientY + TOOLTIP_CURSOR_GAP_Y };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = TOOLTIP_VIEW_MARGIN;
  const gapX = TOOLTIP_CURSOR_GAP_X;
  const gapY = TOOLTIP_CURSOR_GAP_Y;
  const w = Math.min(340, vw - 24);
  const h = Math.min(420, vh - 24);
  let left = clientX + gapX;
  if (left + w > vw - m) left = clientX - w - gapX;
  left = Math.max(m, Math.min(left, vw - w - m));
  let top = clientY + gapY;
  if (top + h > vh - m) top = clientY - h - gapY;
  top = Math.max(m, Math.min(top, vh - h - m));
  return { left, top };
}

const MIN_TILE_SYM_PX = 7;
const MAX_TILE_SYM_PX = 22;

function approxLabelWidth(str, fontPx, charFactor) {
  return String(str).length * fontPx * charFactor;
}

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
      Math.max(approxLabelWidth(symS, symPx, 0.62), approxLabelWidth(pctS, pctPx, 0.56)) + padX * 2;
    const line1H = symPx * 1.15;
    const line2H = pctPx * 1.12;
    const needH = line1H + gap + line2H + padY * 2;
    if (w >= needW && h >= needH) {
      return { symPx, pctPx, line1H, line2H, gap };
    }
  }
  return null;
}

function hexLuminance(hex) {
  const x = String(hex || '').replace('#', '');
  if (x.length !== 6) return 0.5;
  const n = parseInt(x, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Figma uses white tickers; use dark text on light fills (e.g. S1 gold). */
function labelColorsForFill(fillHex) {
  const L = hexLuminance(fillHex);
  if (L > 0.72) {
    return { main: '#0f172a', muted: 'rgba(15, 23, 42, 0.82)' };
  }
  return { main: '#ffffff', muted: 'rgba(255, 255, 255, 0.9)' };
}

function buildSignalGroupHierarchy(weightedRows) {
  const bySig = new Map();
  for (const row of weightedRows) {
    const code = String(row.__signalCode || 'N').toUpperCase();
    if (!bySig.has(code)) bySig.set(code, []);
    bySig.get(code).push(row);
  }

  const children = [];
  const seen = new Set();

  for (const key of ODIN_SIGNAL_GROUP_ORDER) {
    const stocks = bySig.get(key);
    if (!stocks?.length) continue;
    seen.add(key);
    children.push({
      name: key,
      children: stocks.map((t) => {
        const fill = figmaFillForSignal(key);
        return {
          name: t.symbol,
          value: Number(t.__tmw) > 0 ? Number(t.__tmw) : 1,
          symbol: t.symbol,
          security: t.security || '',
          changePct: readChangePct(t),
          price: t.price,
          signalCode: key,
          chartNum: t.__chartNum,
          sector: t.sector,
          industry: t.industry,
          __heatmapFillHex: fill,
          __odinSignalCrumb: `${key} · signal`
        };
      })
    });
  }

  for (const [key, stocks] of bySig) {
    if (seen.has(key) || !stocks?.length) continue;
    children.push({
      name: key,
      children: stocks.map((t) => {
        const fill = figmaFillForSignal(key);
        return {
          name: t.symbol,
          value: Number(t.__tmw) > 0 ? Number(t.__tmw) : 1,
          symbol: t.symbol,
          security: t.security || '',
          changePct: readChangePct(t),
          price: t.price,
          signalCode: key,
          chartNum: t.__chartNum,
          sector: t.sector,
          industry: t.industry,
          __heatmapFillHex: fill,
          __odinSignalCrumb: `${key} · signal`
        };
      })
    });
  }

  return { name: 'root', children };
}

function peersForSignal(rows, featured) {
  const code = String(featured.signalCode || '').toUpperCase();
  return rows
    .filter((r) => String(r.__signalCode || '').toUpperCase() === code)
    .map((r) => ({
      symbol: r.symbol,
      security: r.security || '',
      price: r.price,
      changePct: readChangePct(r),
      weight: Number(r.__tmw) || 0
    }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Odin Signals heatmap: signal-group columns (s1, s3, l1, …), Figma exact colors, white tile gaps.
 */
export function OdinFigmaSignalTreemap({
  rows,
  signalBinSpan = 15,
  highlightSymbol = '',
  disableTooltip = false,
  scaleMin = -3,
  scaleMax = 3
}) {
  const wrapRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState(null);

  const weightedRows = useMemo(
    () => resolveOdinSignalTreemapRows(rows, signalBinSpan),
    [rows, signalBinSpan]
  );

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
    if (!weightedRows.length || size.w < 40 || size.h < 40) return null;
    const data = buildSignalGroupHierarchy(weightedRows);
    if (!data.children?.length) return null;
    const root = hierarchy(data)
      .sum((d) => (d.children ? 0 : d.value))
      .sort((a, b) => {
        const dv = (b.value || 0) - (a.value || 0);
        if (dv !== 0) return dv;
        return String(a.data?.symbol || a.data?.name || '').localeCompare(
          String(b.data?.symbol || b.data?.name || '')
        );
      });
    const tm = d3treemap()
      .tile(treemapSquarify)
      .size([size.w, size.h])
      .paddingOuter(2)
      .paddingInner(2)
      .paddingTop((d) => (d.depth === 1 ? 24 : 0))
      .round(true);
    tm(root);
    return root;
  }, [weightedRows, size.w, size.h]);

  const groupNodes = layoutRoot?.children || [];
  const leaves = layoutRoot?.leaves() || [];

  const peerList = useMemo(() => {
    if (!hover?.data || !weightedRows.length) return [];
    return peersForSignal(weightedRows, hover.data);
  }, [weightedRows, hover?.data?.symbol, hover?.data?.signalCode]);

  if (!rows.length) {
    return (
      <div className="odin-figma-treemap odin-figma-treemap--empty" ref={wrapRef}>
        <p>No data for this index.</p>
      </div>
    );
  }

  if (!layoutRoot) {
    return <div className="odin-figma-treemap odin-figma-treemap--loading" ref={wrapRef} />;
  }

  const tooltipEl =
    !disableTooltip &&
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
    <div className="odin-figma-treemap" ref={wrapRef}>
      {tooltipEl}
      <svg
        className="odin-figma-treemap__svg"
        width={size.w}
        height={size.h}
        role="img"
        aria-label="Odin signal heatmap"
        onMouseLeave={(e) => {
          if (disableTooltip) return;
          const t = e.relatedTarget;
          if (t && typeof t.closest === 'function' && t.closest('.heatmap-tooltip')) return;
          scheduleHide();
        }}
      >
        <rect x={0} y={0} width={size.w} height={size.h} fill="#ffffff" />
        {groupNodes.map((node) => {
          const sw = node.x1 - node.x0;
          const sh = node.y1 - node.y0;
          const band = Math.min(20, Math.max(14, sh * 0.1));
          if (sw < 24 || sh < 18) return null;
          const labelLower = String(node.data.name || '').toLowerCase();
          return (
            <g key={'sig-' + node.data.name}>
              <rect
                x={node.x0}
                y={node.y0}
                width={sw}
                height={band}
                fill="#5c6370"
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={node.x0 + sw / 2}
                y={node.y0 + band * 0.72}
                textAnchor="middle"
                className="odin-figma-treemap__group-label"
                fill="#ffffff"
                fontSize="11px"
                fontWeight="600"
                letterSpacing="0.04em"
                pointerEvents="none"
              >
                {labelLower}
              </text>
            </g>
          );
        })}
        {leaves.map((node) => {
          const w = node.x1 - node.x0;
          const h = node.y1 - node.y0;
          const sym = node.data.symbol || node.data.name;
          const pct = node.data.changePct;
          const code = String(node.data.signalCode || 'N').toUpperCase();
          const fill = figmaFillForSignal(code);
          const { main: fillMain, muted: fillMuted } = labelColorsForFill(fill);
          const active = highlightSymbol && String(sym).toUpperCase() === highlightSymbol.toUpperCase();
          const pctStr = formatChangePct(pct);
          const tooltipTitle = `${sym} — ${pctStr}`;
          const labelFit = fitTileTwoLine(w, h, sym, pctStr);
          const blockH = labelFit ? labelFit.line1H + labelFit.gap + labelFit.line2H : 0;
          const blockTop = labelFit ? node.y0 + (h - blockH) / 2 : 0;
          const ySym = labelFit ? blockTop + labelFit.line1H / 2 : 0;
          const yPct = labelFit
            ? blockTop + labelFit.line1H + labelFit.gap + labelFit.line2H / 2
            : 0;

          return (
            <g
              key={sym + '-' + node.x0 + '-' + node.y0}
              className={'odin-figma-treemap__cell' + (active ? ' odin-figma-treemap__cell--hi' : '')}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                if (disableTooltip) return;
                clearHideTimer();
                const pos = tooltipPosition(e.clientX, e.clientY);
                setHover({
                  left: pos.left,
                  top: pos.top,
                  data: node.data,
                  peerScope: 'signal'
                });
              }}
              onMouseMove={(e) => {
                if (disableTooltip) return;
                const pos = tooltipPosition(e.clientX, e.clientY);
                setHover((prev) => {
                  if (!prev || String(prev.data?.symbol) !== String(sym)) return prev;
                  return { ...prev, left: pos.left, top: pos.top };
                });
              }}
            >
              {disableTooltip ? null : <title>{tooltipTitle}</title>}
              <rect
                x={node.x0}
                y={node.y0}
                width={Math.max(0, w)}
                height={Math.max(0, h)}
                fill={fill}
                stroke="#ffffff"
                strokeWidth={active ? 2.25 : 1.5}
                rx={0}
                ry={0}
              />
              {labelFit ? (
                <>
                  <text
                    x={node.x0 + w / 2}
                    y={ySym}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={fillMain}
                    fontWeight="700"
                    style={{ fontSize: labelFit.symPx }}
                  >
                    {sym}
                  </text>
                  <text
                    x={node.x0 + w / 2}
                    y={yPct}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={fillMuted}
                    fontWeight="600"
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
