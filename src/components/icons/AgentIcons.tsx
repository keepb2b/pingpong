import type { AgentKey } from "@/lib/constants";

type Props = {
  size?: number;
  className?: string;
  /** アニメーションを止める (一覧表示など) */
  still?: boolean;
};

/* ==========================================================================
   6人の専門AI — それぞれの仕事を表すアニメーションアイコン
   すべてCSS/SVGのみ。外部ライブラリを使わない。
   ========================================================================== */

/** AI秘書 — 受け取った情報を吹き出しで受け止め、聞き返す */
export function SecretaryIcon({ size = 40, className = "", still }: Props) {
  const anim = still ? "" : "animate-[typing_1.4s_ease-in-out_infinite]";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.1" />
      <path
        d="M13 17a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9l-6 5v-5h-1a4 4 0 0 1-4-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="22" r="1.8" fill="currentColor" className={anim} style={{ animationDelay: "0s" }} />
      <circle cx="24" cy="22" r="1.8" fill="currentColor" className={anim} style={{ animationDelay: "0.15s" }} />
      <circle cx="29" cy="22" r="1.8" fill="currentColor" className={anim} style={{ animationDelay: "0.3s" }} />
    </svg>
  );
}

/** AIストラテジスト — 目標から逆算する軌道 */
export function StrategistIcon({ size = 40, className = "", still }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.1" />
      <circle cx="24" cy="24" r="13" stroke="currentColor" strokeWidth="2" opacity="0.45" />
      <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      <circle cx="24" cy="24" r="2.6" fill="currentColor" />
      <g className={still ? "" : "animate-[orbit_7s_linear_infinite]"} style={{ transformOrigin: "24px 24px" }}>
        <circle cx="24" cy="11" r="3" fill="currentColor" />
      </g>
      <path
        d="M24 24 L38 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 3"
        opacity="0.6"
      />
    </svg>
  );
}

/** AIライター — 書き進むペン先 */
export function WriterIcon({ size = 40, className = "", still }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.1" />
      <path
        d="M31 12.5 L35.5 17 L20 32.5 L14 34 L15.5 28 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M28.5 15 L33 19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M14 38 H34"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="20"
        className={still ? "" : "animate-[draw_2.6s_ease-in-out_infinite]"}
        opacity="0.75"
      />
    </svg>
  );
}

/** AIマーケター — 届いて広がる同心円 */
export function MarketerIcon({ size = 40, className = "", still }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.1" />
      <path
        d="M15 21 L33 14 L33 34 L15 27 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M18 27 v6a3 3 0 0 0 6 0v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <g className={still ? "" : "animate-[pulse-ring_2.4s_ease-out_infinite]"} style={{ transformOrigin: "33px 24px" }}>
        <circle cx="33" cy="24" r="6" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      </g>
    </svg>
  );
}

/** AIアナリスト — 動く棒グラフ */
export function AnalystIcon({ size = 40, className = "", still }: Props) {
  const bar = still ? "" : "animate-[bar_2.4s_ease-in-out_infinite]";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.1" />
      <path d="M13 34 H35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <rect x="16" y="22" width="4.5" height="11" rx="1.5" fill="currentColor" className={bar}
        style={{ transformOrigin: "18px 33px", animationDelay: "0s" }} />
      <rect x="23" y="17" width="4.5" height="16" rx="1.5" fill="currentColor" className={bar}
        style={{ transformOrigin: "25px 33px", animationDelay: "0.25s" }} />
      <rect x="30" y="13" width="4.5" height="20" rx="1.5" fill="currentColor" className={bar}
        style={{ transformOrigin: "32px 33px", animationDelay: "0.5s" }} />
    </svg>
  );
}

/** AIクリエイター — 色が巡るパレット */
export function CreatorIcon({ size = 40, className = "", still }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.1" />
      <path
        d="M24 12c-6.6 0-12 5-12 11.5S17.4 35 24 35c1.7 0 2.6-1 2.6-2.2 0-1.6-1.4-2-1.4-3.3 0-1.2 1-2.1 2.4-2.1H30c3.3 0 6-2.6 6-5.9C36 16.3 30.6 12 24 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g className={still ? "" : "animate-[float_3.2s_ease-in-out_infinite]"}>
        <circle cx="19" cy="20" r="2" fill="currentColor" opacity="0.9" />
        <circle cx="25" cy="17.5" r="2" fill="currentColor" opacity="0.65" />
        <circle cx="30" cy="21" r="2" fill="currentColor" opacity="0.4" />
      </g>
    </svg>
  );
}

const MAP = {
  secretary: SecretaryIcon,
  strategist: StrategistIcon,
  writer: WriterIcon,
  marketer: MarketerIcon,
  analyst: AnalystIcon,
  creator: CreatorIcon,
} as const;

export function AgentIcon({ agent, ...rest }: Props & { agent: AgentKey }) {
  const Component = MAP[agent] ?? SecretaryIcon;
  return <Component {...rest} />;
}

/* ------------------------------------------------------------- 汎用アイコン */

export function ShieldCheckIcon({ size = 20, className = "" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 3 5 6v5.5c0 4.3 2.9 8.3 7 9.5 4.1-1.2 7-5.2 7-9.5V6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ size = 20, className = "" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 4.5 2.8 20h18.4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 10v4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17.4" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function SparkIcon({ size = 20, className = "", still }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3.5 13.9 9 19.5 11 13.9 13 12 18.5 10.1 13 4.5 11 10.1 9z"
        fill="currentColor"
        className={still ? "" : "animate-[float_3s_ease-in-out_infinite]"}
      />
      <circle cx="18.5" cy="5.5" r="1.4" fill="currentColor" opacity="0.7" />
      <circle cx="5.5" cy="17.5" r="1.1" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function LineIcon({ size = 20, className = "" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M21 10.4C21 6.3 16.97 3 12 3S3 6.3 3 10.4c0 3.67 3.2 6.75 7.52 7.33.29.06.69.19.79.44.09.22.06.57.03.8l-.13.77c-.04.22-.18.88.78.48s5.16-3.04 7.04-5.2C20.3 13.6 21 12.1 21 10.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 8.8v3.4M9 8.8H7.4v3.4h1.9M12.2 8.8v3.4M14.4 12.2V8.8l2.4 3.4V8.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LoopIcon({ size = 20, className = "", still }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} ${still ? "" : "animate-[spin_6s_linear_infinite]"}`}
      aria-hidden
    >
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M20 4v4.5h-4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
