"use client";

import { useId, useState } from "react";

/* ==========================================================================
   AI広報 — チャート
   配色は検証済みパレット (validate_palette.js で全チェック通過)。
   ライトモードでコントラストが 3:1 未満の系列があるため、
   すべてのチャートで直接ラベル + 表形式の代替表示を必ず用意する。
   ========================================================================== */

const nf = new Intl.NumberFormat("ja-JP");

function TableFallback({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: Array<Array<string | number>>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] muted hover:text-[var(--text)] underline underline-offset-2"
        aria-expanded={open}
      >
        {open ? "表を閉じる" : "数値を表で見る"}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto scroll-thin">
          <table className="w-full text-xs border-collapse">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-[var(--border)]">
                {head.map((h) => (
                  <th key={h} className="text-left py-1.5 pr-4 font-medium muted whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className={`py-1.5 pr-4 ${j > 0 ? "tabular-nums" : ""}`}>
                      {typeof c === "number" ? nf.format(c) : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================= 顧客導線 === */
export type FunnelStage = { label: string; value: number; hint?: string };

/**
 * 顧客導線ファネル。
 * 「投稿を見る → 記事を読む → CTAクリック → 問い合わせ → 成約」の
 * どこで離脱しているかを、段階間の残存率で示す。
 */
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="viz-root">
      <div className="space-y-2.5">
        {stages.map((s, i) => {
          const pct = (s.value / max) * 100;
          const prev = i > 0 ? stages[i - 1].value : null;
          const retention = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
          const isDropOff = retention !== null && retention < 25;

          return (
            <div
              key={s.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="relative"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-xs font-medium">{s.label}</span>
                <span className="text-xs tabular-nums font-semibold">
                  {nf.format(s.value)}
                  {retention !== null && (
                    <span className={`ml-2 font-normal ${isDropOff ? "text-red-600" : "muted"}`}>
                      残存 {retention}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-7 rounded-[3px] overflow-hidden bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-[3px] transition-[width,opacity] duration-500 ease-out"
                  style={{
                    width: `${Math.max(pct, 1.5)}%`,
                    background: `var(--ord-${Math.min(i + 1, 5)})`,
                    opacity: hover === null || hover === i ? 1 : 0.55,
                  }}
                />
              </div>
              {hover === i && s.hint && (
                <div className="absolute z-10 left-0 top-full mt-1 px-2.5 py-1.5 rounded-[3px] bg-ink-900 text-white text-[11px] shadow-lg max-w-xs">
                  {s.hint}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TableFallback
        caption="顧客導線の各段階の件数"
        head={["段階", "件数"]}
        rows={stages.map((s) => [s.label, s.value])}
      />
    </div>
  );
}

/* ========================================================= AI広報スコア === */
/**
 * スコアは10観点の「大きさ比較」なので、単一色相の濃淡で表す。
 * 観点ごとに色を変えない (色は識別のためのもので、順位のためではない)。
 */
export function ScoreBars({
  items,
}: {
  items: Array<{ label: string; value: number; note?: string }>;
}) {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="viz-root">
      <div className="space-y-2">
        {items.map((it) => {
          const weak = it.value < 60;
          return (
            <div
              key={it.label}
              className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3"
              onMouseEnter={() => setHover(it.label)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="text-xs truncate" title={it.label}>
                {it.label}
              </span>
              <div className="h-5 rounded-[3px] overflow-hidden bg-[var(--surface-3)] relative">
                <div
                  className="h-full rounded-[3px] transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(it.value, 1)}%`,
                    background: weak ? "var(--ord-2)" : "var(--seq)",
                    opacity: hover === null || hover === it.label ? 1 : 0.6,
                  }}
                />
              </div>
              <span
                className={`text-xs tabular-nums text-right font-semibold ${weak ? "text-amber-600" : ""}`}
              >
                {it.value}
              </span>
              {hover === it.label && it.note && (
                <div className="col-span-3 -mt-1 text-[11px] muted leading-relaxed pl-[8.25rem]">
                  {it.note}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TableFallback
        caption="AI広報スコアの各観点の点数"
        head={["観点", "点数"]}
        rows={items.map((i) => [i.label, i.value])}
      />
    </div>
  );
}

/* ========================================================== 時系列推移 ==== */
export type SeriesPoint = { x: string; y: number };
export type Series = { name: string; points: SeriesPoint[] };

/** 折れ線。系列は最大5つまで (それ以上は「その他」にまとめる)。 */
export function TrendChart({
  series,
  height = 200,
  unit = "",
}: {
  series: Series[];
  height?: number;
  unit?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const [cursor, setCursor] = useState<number | null>(null);

  const labels = series[0]?.points.map((p) => p.x) ?? [];
  const n = labels.length;
  if (!n) return <p className="muted text-xs py-8 text-center">データがありません</p>;

  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const maxY = Math.max(1, ...allY);
  const padL = 38;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const w = 560;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;

  const xAt = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - (v / maxY) * innerH;

  const ticks = [0, 0.5, 1].map((f) => Math.round(maxY * f));

  return (
    <div className="viz-root">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
          {series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 text-xs">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: `var(--series-${(i % 5) + 1})` }}
                aria-hidden
              />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${series.map((s) => s.name).join("、")}の推移`}
        onMouseLeave={() => setCursor(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - rect.left) / rect.width) * w;
          const i = Math.round(((rel - padL) / innerW) * (n - 1));
          setCursor(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={w - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="var(--viz-grid)"
              strokeWidth="1"
            />
            <text
              x={padL - 6}
              y={yAt(t) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--viz-axis)"
              className="tabular-nums"
            >
              {nf.format(t)}
            </text>
          </g>
        ))}

        {labels.map((l, i) =>
          i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
            <text
              key={`${l}-${i}`}
              x={xAt(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize="10"
              fill="var(--viz-axis)"
            >
              {l}
            </text>
          ) : null,
        )}

        {cursor !== null && (
          <line
            x1={xAt(cursor)}
            x2={xAt(cursor)}
            y1={padT}
            y2={padT + innerH}
            stroke="var(--viz-axis)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.6"
          />
        )}

        {series.map((s, si) => {
          const color = `var(--series-${(si % 5) + 1})`;
          const d = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.y)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <defs>
                <linearGradient id={`fill-${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {series.length === 1 && (
                <path
                  d={`${d} L ${xAt(n - 1)} ${padT + innerH} L ${xAt(0)} ${padT + innerH} Z`}
                  fill={`url(#fill-${uid}-${si})`}
                />
              )}
              <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {cursor !== null && s.points[cursor] && (
                <circle
                  cx={xAt(cursor)}
                  cy={yAt(s.points[cursor].y)}
                  r="4.5"
                  fill={color}
                  stroke="var(--viz-surface)"
                  strokeWidth="2"
                />
              )}
            </g>
          );
        })}
      </svg>

      {cursor !== null && (
        <div className="mt-1 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="muted">{labels[cursor]}</span>
          {series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: `var(--series-${(i % 5) + 1})` }}
                aria-hidden
              />
              <span className="tabular-nums font-medium">
                {nf.format(s.points[cursor]?.y ?? 0)}
                {unit}
              </span>
            </span>
          ))}
        </div>
      )}

      <TableFallback
        caption="推移データ"
        head={["期間", ...series.map((s) => s.name)]}
        rows={labels.map((l, i) => [l, ...series.map((s) => s.points[i]?.y ?? 0)])}
      />
    </div>
  );
}

/* ========================================================== 媒体別比較 ==== */
/** 媒体ごとの比較。系列 = 媒体という「識別」なのでカテゴリ配色を使う。 */
export function ChannelBars({
  items,
  unit = "",
}: {
  items: Array<{ label: string; value: number }>;
  unit?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  if (!items.length) {
    return <p className="muted text-xs py-8 text-center">データがありません</p>;
  }

  return (
    <div className="viz-root">
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={it.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
            <span className="text-xs truncate flex items-center gap-1.5" title={it.label}>
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: `var(--series-${(i % 5) + 1})` }}
                aria-hidden
              />
              {it.label}
            </span>
            <div className="h-5 rounded-[3px] overflow-hidden bg-[var(--surface-3)]">
              <div
                className="h-full rounded-[3px] transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.max((it.value / max) * 100, 1)}%`,
                  background: `var(--series-${(i % 5) + 1})`,
                }}
              />
            </div>
            <span className="text-xs tabular-nums font-semibold min-w-[3rem] text-right">
              {nf.format(it.value)}
              {unit}
            </span>
          </div>
        ))}
      </div>

      <TableFallback
        caption="媒体別の実績"
        head={["媒体", "値"]}
        rows={items.map((i) => [i.label, i.value])}
      />
    </div>
  );
}

/* ============================================================ スコア環 ==== */
/** 総合スコアの単一指標表示 (ヒーロー数値 + 進捗リング)。 */
export function ScoreRing({ value, size = 132 }: { value: number; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100);

  return (
    <div className="viz-root relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`AI広報スコア ${value}点`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--seq)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums leading-none">{value}</span>
        <span className="muted text-[10px] mt-1">/ 100点</span>
      </div>
    </div>
  );
}
