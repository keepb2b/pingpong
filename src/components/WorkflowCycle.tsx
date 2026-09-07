"use client";

import { useState } from "react";
import styles from "./WorkflowCycle.module.css";

const CX = 200;
const CY = 200;
const INNER = 74;
const OUTER = 176;
const ICON_R = (INNER + OUTER) / 2;
const N = 9;
const SWEEP = 360 / N;
const GAP = 1.5;

const STEPS = [
  {
    label: "情報収集",
    agent: "AI秘書",
    body: "日々の出来事と広報材料を集めます。",
    color: "#7ec8e8",
    icon: "collect",
  },
  {
    label: "AI取材",
    agent: "AI秘書",
    body: "必要な情報を1問ずつ聞き取ります。",
    color: "#4ea3d8",
    icon: "interview",
  },
  {
    label: "戦略判断",
    agent: "AIストラテジスト",
    body: "今日発信すべきかを判断します。",
    color: "#3b8fc9",
    icon: "strategy",
  },
  {
    label: "コンテンツ制作",
    agent: "AIライター",
    body: "記事・投稿・PRの言葉を作ります。",
    color: "#1f6fb3",
    icon: "write",
  },
  {
    label: "リスク確認",
    agent: "AIアナリスト",
    body: "公式事実と照合し、危険を止めます。",
    color: "#155a9c",
    icon: "risk",
  },
  {
    label: "ユーザー承認",
    agent: "AI秘書",
    body: "LINEから承認・修正・保留できます。",
    color: "#2f7ab8",
    icon: "approve",
  },
  {
    label: "投稿・配信",
    agent: "AIマーケター",
    body: "各媒体の最適な形で届けます。",
    color: "#3d8fc4",
    icon: "publish",
  },
  {
    label: "売上計測",
    agent: "AIアナリスト",
    body: "表示から成約まで成果を追います。",
    color: "#6bb8de",
    icon: "measure",
  },
  {
    label: "学習・改善",
    agent: "AIストラテジスト",
    body: "結果を次の循環へフィードバックします。",
    color: "#8fd0ea",
    icon: "learn",
  },
] as const;

function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function slicePath(i: number) {
  const a0 = -90 - SWEEP / 2 + i * SWEEP + GAP / 2;
  const a1 = a0 + SWEEP - GAP;
  const o0 = polar(OUTER, a0);
  const o1 = polar(OUTER, a1);
  const i1 = polar(INNER, a1);
  const i0 = polar(INNER, a0);
  return `M ${o0.x} ${o0.y} A ${OUTER} ${OUTER} 0 0 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${INNER} ${INNER} 0 0 0 ${i0.x} ${i0.y} Z`;
}

function centerDeg(i: number) {
  return -90 + i * SWEEP;
}

export function WorkflowCycle() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className={styles.wrap}>
      <div className={styles.stage}>
        <svg className={styles.wheel} viewBox="0 0 400 400" role="img" aria-label="広報活動の9つの循環">
          {STEPS.map((step, i) => {
            const c = polar(ICON_R, centerDeg(i));
            return (
              <g
                key={step.label}
                className={styles.slice}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                tabIndex={0}
              >
                <path
                  d={slicePath(i)}
                  fill={step.color}
                  opacity={active === null || active === i ? 1 : 0.55}
                />
                <g transform={`translate(${c.x}, ${c.y})`} fill="#fff" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <SliceIcon name={step.icon} />
                </g>
              </g>
            );
          })}

          <circle cx={CX} cy={CY} r={INNER - 2} fill="#fff" />
          <g transform={`translate(${CX}, ${CY})`} fill="none" stroke="#2f7ab8" strokeWidth="1.8">
            <circle r="7" fill="#2f7ab8" stroke="none" />
            {[0, 60, 120, 180, 240, 300].map((d) => {
              const rad = (d * Math.PI) / 180;
              const x = Math.cos(rad) * 22;
              const y = Math.sin(rad) * 22;
              return (
                <g key={d}>
                  <line x1="0" y1="0" x2={x} y2={y} />
                  <circle cx={x} cy={y} r="4.5" fill="#fff" />
                </g>
              );
            })}
            <circle r="11" strokeWidth="2.2" />
          </g>
        </svg>

        {STEPS.map((step, i) => {
          const deg = centerDeg(i);
          const rad = (deg * Math.PI) / 180;
          const r = 38;
          const left = 50 + r * Math.cos(rad);
          const top = 50 + r * Math.sin(rad);
          const n = String(i + 1).padStart(2, "0");
          return (
            <div
              key={step.label}
              className={styles.caption}
              style={{ left: `${left}%`, top: `${top}%`, borderColor: step.color }}
              data-side={captionSide(deg)}
            >
              <p className={styles.captionTitle} style={{ color: step.color }}>
                {n} {step.label}
              </p>
              <p className={styles.captionBody}>{step.body}</p>
              <p className={styles.captionAgent}>{step.agent}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function captionSide(deg: number) {
  const a = ((deg % 360) + 360) % 360;
  if (a > 60 && a < 120) return "bottom";
  if (a >= 120 && a <= 240) return "left";
  if (a > 240 && a < 300) return "top";
  return "right";
}

function SliceIcon({ name }: { name: (typeof STEPS)[number]["icon"] }) {
  const p = { x: -10, y: -10, width: 20, height: 20, viewBox: "0 0 24 24" };
  switch (name) {
    case "collect":
      return (
        <svg {...p}>
          <path d="M4 11h16v9H4z" fill="none" />
          <path d="M4 11 7 5h10l3 6" fill="none" />
          <path d="M4 11h5l1.5 2.5h5L17 11h3" fill="none" />
        </svg>
      );
    case "interview":
      return (
        <svg {...p}>
          <path d="M5 6h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="none" />
        </svg>
      );
    case "strategy":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" fill="none" />
          <circle cx="12" cy="12" r="3.5" fill="none" />
          <circle cx="12" cy="12" r="1.2" fill="#fff" stroke="none" />
        </svg>
      );
    case "write":
      return (
        <svg {...p}>
          <path d="M13 5 19 11 8 22H3v-5z" fill="none" />
          <path d="m12 6 6 6" fill="none" />
        </svg>
      );
    case "risk":
      return (
        <svg {...p}>
          <path d="M12 3 20 7v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" fill="none" />
          <path d="m8.5 12 2.5 2.5 4.5-5" fill="none" />
        </svg>
      );
    case "approve":
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="3.2" fill="none" />
          <path d="M5.5 19c.8-3.4 3.3-5 6.5-5s5.7 1.6 6.5 5" fill="none" />
          <path d="m15.5 10.5 2 2 3.5-4" fill="none" />
        </svg>
      );
    case "publish":
      return (
        <svg {...p}>
          <path d="M4 12 16 7v10z" fill="none" />
          <path d="M18 9.5a4 4 0 0 1 0 5" fill="none" />
        </svg>
      );
    case "measure":
      return (
        <svg {...p}>
          <path d="M4 19V5" fill="none" />
          <path d="M4 19h16" fill="none" />
          <path d="m7 14 3.5-4 3 2.5L20 7" fill="none" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <path d="M12 6v4" fill="none" />
          <path d="M12 14v4" fill="none" />
          <path d="M8 8.5 5.5 6" fill="none" />
          <path d="m16 15.5 2.5 2.5" fill="none" />
          <circle cx="12" cy="12" r="3.2" fill="none" />
        </svg>
      );
  }
}
