"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./ProblemsDiagram.module.css";

type Side = "left" | "right";

const ITEMS: { text: string; side: Side }[] = [
  { text: "専任の広報担当者を採用できない", side: "left" },
  { text: "何を発信すればよいか分からない", side: "left" },
  { text: "日々の業務が忙しく、発信を継続できない", side: "left" },
  { text: "SNSやブログの内容が思いつかない", side: "left" },
  { text: "AIを使っても、自社らしい文章にならない", side: "left" },
  { text: "投稿しても、売上につながっているか分からない", side: "right" },
  { text: "媒体ごとの管理や分析に時間がかかる", side: "right" },
  { text: "社内にある広報材料を集められない", side: "right" },
  { text: "競合や市場の変化を追いきれない", side: "right" },
  { text: "広報活動の改善方法が分からない", side: "right" },
];

export function ProblemsDiagram() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function draw() {
      const box = canvasRef.current?.getBoundingClientRect();
      const hub = hubRef.current?.getBoundingClientRect();
      if (!box || !hub || box.width === 0) return;

      const cx = hub.left - box.left + hub.width / 2;
      const cy = hub.top - box.top + hub.height / 2;
      const radius = hub.width / 2 - 2;

      const next = ITEMS.map((item, i) => {
        const el = labelRefs.current[i];
        if (!el) return "";
        const n = el.getBoundingClientRect();
        const ex = (item.side === "left" ? n.right : n.left) - box.left;
        const ey = n.top - box.top + n.height / 2;
        const dir = item.side === "left" ? -1 : 1;
        const sx = cx + dir * radius * 0.82;
        const sy = cy;
        const jx = ex - dir * 18;
        return `M ${sx} ${sy} L ${jx} ${ey} L ${ex} ${ey}`;
      }).filter(Boolean);

      setLines(next);
    }

    const id = window.requestAnimationFrame(draw);
    const ro = new ResizeObserver(draw);
    ro.observe(root);
    window.addEventListener("resize", draw);
    return () => {
      window.cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, []);

  const left = ITEMS.map((item, i) => ({ ...item, i })).filter((x) => x.side === "left");
  const right = ITEMS.map((item, i) => ({ ...item, i })).filter((x) => x.side === "right");

  return (
    <div
      ref={rootRef}
      className="relative overflow-hidden rounded-[12px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
      style={{
        background: "var(--surface-2)",
      }}
    >
      <div className="relative z-[1] mb-8 lg:mb-10 lg:max-w-[42%]">
        <h2 className="font-sans text-[20px] sm:text-[22px] font-bold text-[var(--text)] tracking-tight">
          AI広報が解決する課題
        </h2>
        <p className="mt-2 text-[12.5px] sm:text-[13px] leading-[1.9] text-[var(--text-muted)]">
          多くの企業や店舗では、広報の重要性を理解していても、次のような問題を抱えています。
          AI広報は、これらの業務を一つの仕組みに統合します。
        </p>
      </div>

      {/* モバイル: 縦積み */}
      <ul className="relative z-[1] grid gap-2.5 lg:hidden">
        {ITEMS.map((item) => (
          <li key={item.text} className="flex items-center gap-2.5">
            <Capsule>{item.text}</Capsule>
          </li>
        ))}
      </ul>

      {/* デスクトップ: ハブ＆スポーク */}
      <div
        ref={canvasRef}
        className="relative z-[1] hidden lg:grid grid-cols-[1fr_280px_1fr] items-center gap-x-2 min-h-[520px]"
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          {lines.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--color-brand-300)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          ))}
        </svg>

        <div className="flex flex-col justify-between h-[500px] py-1">
          {left.map((item) => (
            <div
              key={item.text}
              ref={(el) => { labelRefs.current[item.i] = el; }}
              className="flex items-center justify-end"
            >
              <Capsule align="right">{item.text}</Capsule>
            </div>
          ))}
        </div>

        <div className="relative z-[2] grid place-items-center">
          <div ref={hubRef} className="relative h-[196px] w-[196px]">
            <div className={styles.ripples} aria-hidden="true">
              <span className={styles.ripple} />
              <span className={styles.ripple} />
              <span className={styles.ripple} />
            </div>
            <div
              className="relative h-full w-full rounded-full grid place-items-center text-center px-5"
              style={{
                background: "radial-gradient(circle at 38% 32%, var(--color-brand-400) 0%, var(--color-brand-600) 58%, var(--color-brand-800) 100%)",
                boxShadow:
                  "0 0 0 8px rgb(31 90 156 / 0.16), 0 0 0 20px rgb(31 90 156 / 0.10), 0 0 0 34px rgb(31 90 156 / 0.07), 0 0 0 48px rgb(31 90 156 / 0.04), 0 16px 40px rgb(14 47 87 / 0.18)",
              }}
            >
              <p className="font-sans text-white font-bold leading-snug tracking-wide">
                <span className="block text-[11px] font-semibold tracking-[0.18em] text-white/75 mb-1">
                  AI KOHO
                </span>
                <span className="block text-[18px]">解決する</span>
                <span className="block text-[18px]">10の課題</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between h-[500px] py-1">
          {right.map((item) => (
            <div
              key={item.text}
              ref={(el) => { labelRefs.current[item.i] = el; }}
              className="flex items-center justify-start"
            >
              <Capsule imageSide="right">{item.text}</Capsule>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Capsule({
  children,
  align = "left",
  imageSide = "left",
}: {
  children: string;
  align?: "left" | "right";
  imageSide?: Side;
}) {
  return (
    <p
      className={`relative flex-1 min-w-0 min-h-16 lg:min-h-[72px] flex items-center py-2.5 text-[12.5px] leading-snug text-[var(--text)] font-medium rounded-full border border-[var(--border)] ${
        imageSide === "left" ? "pl-16 pr-4 lg:pl-20" : "pl-4 pr-16 lg:pr-20"
      } ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={{
        background: "var(--surface)",
        boxShadow: "0 2px 6px rgb(14 47 87 / 0.04)",
      }}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 h-14 w-14 lg:h-[76px] lg:w-[76px] ${
          imageSide === "left" ? "-left-1 lg:-left-3" : "-right-1 lg:-right-3"
        }`}
      >
        <Image
          src={`/images/issues/${children}.png`}
          alt=""
          fill
          sizes="(min-width: 1024px) 76px, 56px"
          className="rounded-full object-contain"
        />
      </span>
      <span className="w-full">{children}</span>
    </p>
  );
}
