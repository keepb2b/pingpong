import styles from "./FunnelFlow.module.css";

const STEPS = [
  { label: "投稿を見る", color: "#7c5cbf" },
  { label: "記事を読む", color: "#22c5e0" },
  { label: "CTAをクリックする", color: "#3b7fd9" },
  { label: "問い合わせ・予約をする", color: "#3dcc6a" },
  { label: "購入・成約する", color: "#1a9a63" },
] as const;

export function FunnelFlow() {
  return (
    <div className="card p-5 sm:p-6">
      <p className="text-[13px] font-bold mb-2">
        集客が目的であれば、閲覧数ではなく顧客導線の全体を分析します
      </p>
      <div className={styles.scroller}>
        <ol className={styles.flow} aria-label="顧客導線">
          {STEPS.map((step, i) => (
            <li key={step.label} className={styles.node}>
              <svg className={styles.orbit} viewBox="0 0 140 140" aria-hidden>
                <defs>
                  <marker
                    id={`funnel-arrow-${i}`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M0 0 L10 5 L0 10 z" fill={step.color} />
                  </marker>
                </defs>
                <circle
                  cx="70"
                  cy="70"
                  r="62"
                  fill="none"
                  stroke="#d5dbe1"
                  strokeWidth="1.6"
                  strokeDasharray="3.5 5"
                />
                <path
                  d={i % 2 === 0 ? BOTTOM_ARC : TOP_ARC}
                  fill="none"
                  stroke={step.color}
                  strokeWidth="7"
                  strokeLinecap="round"
                  markerEnd={`url(#funnel-arrow-${i})`}
                />
              </svg>
              <div className={styles.disc} style={{ background: step.color }}>
                <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.label}>{step.label}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** 下側の弧：右端で上向き（次のノードへつながる波） */
const BOTTOM_ARC = "M 22 86 A 52 52 0 0 0 124 54";
/** 上側の弧：右端で下向き */
const TOP_ARC = "M 22 54 A 52 52 0 0 1 124 86";
