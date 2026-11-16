import React, { useState } from 'react';

export interface BarDatum {
  label: string;
  sales: number;
  purchase: number;
  profit: number;
}

export const SixMonthBarChart: React.FC<{
  data: BarDatum[];
  formatVal: (v: number) => string;
  labels: { sales: string; purchase: string; profit: string };
}> = ({ data, formatVal, labels }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.sales, d.purchase, Math.max(0, d.profit)])
  );
  const width = 620;
  const height = 220;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const groupW = plotW / Math.max(1, data.length);
  const barW = Math.min(14, Math.max(8, groupW * 0.22));

  return (
    <div className="relative w-full">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
          {labels.sales}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-slate-700" />
          {labels.purchase}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-teal-400" />
          {labels.profit}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="6-month sales purchase profit chart"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = padT + plotH * (1 - t);
          return (
            <g key={i}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={t === 0 ? undefined : '3 3'}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[9px] font-mono"
              >
                {Math.round((maxVal * t) / 1000)}k
              </text>
            </g>
          );
        })}

        {data.map((d, idx) => {
          const cx = padL + idx * groupW + groupW / 2;
          const hSale = (Math.max(0, d.sales) / maxVal) * plotH;
          const hPur = (Math.max(0, d.purchase) / maxVal) * plotH;
          const hProf = (Math.max(0, d.profit) / maxVal) * plotH;

          return (
            <g
              key={d.label}
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={cx - groupW / 2 + 2}
                y={padT}
                width={groupW - 4}
                height={plotH}
                rx={4}
                fill={hoverIdx === idx ? '#f1f5f9' : 'transparent'}
              />
              <rect
                x={cx - barW * 1.65}
                y={padT + plotH - hSale}
                width={barW}
                height={Math.max(2, hSale)}
                rx={2}
                fill="#059669"
              />
              <rect
                x={cx - barW * 0.5}
                y={padT + plotH - hPur}
                width={barW}
                height={Math.max(2, hPur)}
                rx={2}
                fill="#334155"
              />
              <rect
                x={cx + barW * 0.65}
                y={padT + plotH - hProf}
                width={barW}
                height={Math.max(2, hProf)}
                rx={2}
                fill="#2dd4bf"
              />
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-medium"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hoverIdx !== null && data[hoverIdx] && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs tabular-nums">
          <span className="font-semibold text-slate-800">{data[hoverIdx].label}</span>
          <div className="flex flex-wrap gap-3">
            <span className="text-emerald-700">
              {labels.sales}: <strong className="font-mono">{formatVal(data[hoverIdx].sales)}</strong>
            </span>
            <span className="text-slate-700">
              {labels.purchase}: <strong className="font-mono">{formatVal(data[hoverIdx].purchase)}</strong>
            </span>
            <span className="text-teal-700">
              {labels.profit}: <strong className="font-mono">{formatVal(data[hoverIdx].profit)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export interface TrendDatum {
  label: string;
  sales: number;
  expense: number;
}

export const FourteenDayTrendChart: React.FC<{
  data: TrendDatum[];
  formatVal: (v: number) => string;
  labels: { sales: string; expense: string };
}> = ({ data, formatVal, labels }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.sales, d.expense]));
  const width = 620;
  const height = 220;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const pointsSale = data.map((d, i) => {
    const x = padL + (i / Math.max(1, data.length - 1)) * plotW;
    const y = padT + plotH - (d.sales / maxVal) * plotH;
    return { x, y };
  });

  const pointsExp = data.map((d, i) => {
    const x = padL + (i / Math.max(1, data.length - 1)) * plotW;
    const y = padT + plotH - (d.expense / maxVal) * plotH;
    return { x, y };
  });

  const pathSale = pointsSale
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaSale =
    pathSale +
    ` L ${pointsSale[pointsSale.length - 1]?.x.toFixed(1) || padL} ${(padT + plotH).toFixed(1)} L ${padL} ${(padT + plotH).toFixed(1)} Z`;

  const pathExp = pointsExp
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className="relative w-full">
      <div className="mb-3 flex items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
          {labels.sales}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
          {labels.expense}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="14-day trend chart"
      >
        <defs>
          <linearGradient id="bproSaleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = padT + plotH * (1 - t);
          return (
            <g key={i}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={t === 0 ? undefined : '3 3'}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[9px] font-mono"
              >
                {Math.round((maxVal * t) / 1000)}k
              </text>
            </g>
          );
        })}

        {pointsSale.length > 1 && <path d={areaSale} fill="url(#bproSaleGrad)" />}
        {pointsSale.length > 1 && (
          <path d={pathSale} fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {pointsExp.length > 1 && (
          <path d={pathExp} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="4 3" strokeLinecap="round" />
        )}

        {data.map((d, i) => {
          const ps = pointsSale[i];
          const pe = pointsExp[i];
          return (
            <g
              key={d.label}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={ps.x - 16}
                y={padT}
                width={32}
                height={plotH}
                fill="transparent"
              />
              {hoverIdx === i && (
                <line
                  x1={ps.x}
                  y1={padT}
                  x2={ps.x}
                  y2={padT + plotH}
                  stroke="#94a3b8"
                  strokeDasharray="2 2"
                />
              )}
              <circle
                cx={ps.x}
                cy={ps.y}
                r={hoverIdx === i ? 4.5 : 2.8}
                fill="#059669"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <circle
                cx={pe.x}
                cy={pe.y}
                r={hoverIdx === i ? 4 : 2.3}
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1.2"
              />
              {(i % 2 === 0 || i === data.length - 1) && (
                <text
                  x={ps.x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-400 text-[9px] font-mono"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hoverIdx !== null && data[hoverIdx] && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs tabular-nums">
          <span className="font-semibold text-slate-800">{data[hoverIdx].label}</span>
          <div className="flex gap-3">
            <span className="text-emerald-700">
              {labels.sales}: <strong className="font-mono">{formatVal(data[hoverIdx].sales)}</strong>
            </span>
            <span className="text-amber-700">
              {labels.expense}: <strong className="font-mono">{formatVal(data[hoverIdx].expense)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export const DonutChart: React.FC<{
  title: string;
  slices: DonutSlice[];
  centerLabel?: string;
  formatVal: (v: number) => string;
}> = ({ title, slices, centerLabel, formatVal }) => {
  const positive = slices.filter((s) => s.value > 0);
  const total = positive.reduce((s, d) => s + d.value, 0);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="text-xs font-semibold text-slate-700 mb-3">{title}</h4>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="12"
            />
            {total > 0 &&
              positive.map((slice) => {
                const pct = slice.value / total;
                const strokeLen = pct * circumference;
                const dashOffset = -accumulated * circumference;
                accumulated += pct;
                return (
                  <circle
                    key={slice.label}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="12"
                    strokeDasharray={`${strokeLen} ${circumference}`}
                    strokeDashoffset={dashOffset}
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-bold font-mono text-slate-800 tabular-nums">
              {centerLabel ?? formatVal(total)}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {slices.length === 0 || total === 0 ? (
            <p className="text-xs text-slate-400">No data</p>
          ) : (
            slices.slice(0, 4).map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 truncate text-slate-600">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="font-mono font-medium text-slate-900 tabular-nums shrink-0">
                  {formatVal(s.value)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
