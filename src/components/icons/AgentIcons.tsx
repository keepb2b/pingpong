import type { AgentKey } from "@/lib/constants";

/* ==========================================================================
   担当AIのアイコン
   ナビゲーションのアイコンと同じ線画の作法に揃える。
   常時動くアニメーションは付けない (業務画面での視線移動を妨げるため)。
   ========================================================================== */

type Props = {
  size?: number;
  className?: string;
  /** 互換のために残している。現在は装飾アニメーションを持たない。 */
  still?: boolean;
};

const stroke = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 32 32",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** AI秘書 — 聞き取り */
export function SecretaryIcon({ size = 32, className = "" }: Props) {
  return (
    <svg {...stroke(size)} className={className}>
      <path d="M5 10.5A2.5 2.5 0 0 1 7.5 8h17a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H14l-6 4.5V22h-.5A2.5 2.5 0 0 1 5 19.5z" />
      <circle cx="11.5" cy="15" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="20.5" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** AIストラテジスト — 目標から逆算 */
export function StrategistIcon({ size = 32, className = "" }: Props) {
  return (
    <svg {...stroke(size)} className={className}>
      <circle cx="16" cy="16" r="10.5" />
      <circle cx="16" cy="16" r="5.5" />
      <circle cx="16" cy="16" r="1.6" fill="currentColor" stroke="none" />
      <path d="M16 16 26 6" />
      <path d="M22 6h4v4" />
    </svg>
  );
}

/** AIライター — 制作 */
export function WriterIcon({ size = 32, className = "" }: Props) {
  return (
    <svg {...stroke(size)} className={className}>
      <path d="M21.5 5.8 26.2 10.5 12.5 24.2 6.6 25.4 7.8 19.5z" />
      <path d="m19.2 8.1 4.7 4.7" />
      <path d="M6 28h20" />
    </svg>
  );
}

/** AIマーケター — 届ける */
export function MarketerIcon({ size = 32, className = "" }: Props) {
  return (
    <svg {...stroke(size)} className={className}>
      <path d="M6 13.5 21 8v16l-15-5.5z" />
      <path d="M10 19.2V24a2.6 2.6 0 0 0 5.2 0v-3.2" />
      <path d="M24.5 12.6a5 5 0 0 1 0 6.8" />
      <path d="M27 9.6a9 9 0 0 1 0 12.8" />
    </svg>
  );
}

/** AIアナリスト — 検証 */
export function AnalystIcon({ size = 32, className = "" }: Props) {
  return (
    <svg {...stroke(size)} className={className}>
      <path d="M5 5v22h22" />
      <rect x="9" y="16" width="4" height="7" fill="currentColor" stroke="none" opacity="0.85" />
      <rect x="15.5" y="12" width="4" height="11" fill="currentColor" stroke="none" opacity="0.85" />
      <rect x="22" y="8" width="4" height="15" fill="currentColor" stroke="none" opacity="0.85" />
    </svg>
  );
}

/** AIクリエイター — 見せる */
export function CreatorIcon({ size = 32, className = "" }: Props) {
  return (
    <svg {...stroke(size)} className={className}>
      <path d="M16 5c-6.1 0-11 4.6-11 10.5S9.9 26 16 26c1.6 0 2.6-.9 2.6-2.2 0-1.5-1.3-1.9-1.3-3.1 0-1.1 1-2 2.3-2H22c3.1 0 5.5-2.4 5.5-5.5C27.5 8.6 22.4 5 16 5Z" />
      <circle cx="11" cy="13.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="21" cy="13" r="1.6" fill="currentColor" stroke="none" />
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

/* ------------------------------------------------------------- 汎用 ----- */

export function ShieldCheckIcon({ size = 20, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 3 5 5.8v5.4c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V5.8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2.2 2.2L15.5 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertIcon({ size = 20, className = "" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 4.2 2.8 20h18.4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="17.4" r="1.05" fill="currentColor" />
    </svg>
  );
}

/** LINE */
export function LineIcon({ size = 20, className = "" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M21 10.4C21 6.3 16.97 3 12 3S3 6.3 3 10.4c0 3.67 3.2 6.75 7.52 7.33.29.06.69.19.79.44.09.22.06.57.03.8l-.13.77c-.04.22-.18.88.78.48s5.16-3.04 7.04-5.2C20.3 13.6 21 12.1 21 10.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.8v3.4M9 8.8H7.4v3.4h1.9M12.2 8.8v3.4M14.4 12.2V8.8l2.4 3.4V8.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 循環 */
export function LoopIcon({ size = 20, className = "" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M20 4v4.5h-4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
