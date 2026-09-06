/* ==========================================================================
   AI広報 ロゴ
   紺地の角丸スクエアに拡声器 (広報=伝える) を白抜きし、
   発信の広がりを3本の弧、成果を朱の点で表す。
   小さいサイズでも潰れないよう、線幅と余白を固定値で持つ。
   ========================================================================== */

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role="img"
      aria-label="AI広報"
    >
      <rect width="40" height="40" rx="5" fill="var(--color-brand-600)" />
      {/* 拡声器 */}
      <path
        d="M11 17.2v5.6a1.2 1.2 0 0 0 1.2 1.2h2.3l7.4 4.3a.9.9 0 0 0 1.35-.78V12.48a.9.9 0 0 0-1.35-.78L14.5 16h-2.3A1.2 1.2 0 0 0 11 17.2Z"
        fill="#ffffff"
      />
      <path
        d="M15.6 24.3v2.9a1.7 1.7 0 0 0 3.4 0v-1"
        stroke="#ffffff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 発信の広がり */}
      <path
        d="M26.4 15.8a6.2 6.2 0 0 1 0 8.4"
        stroke="#ffffff"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M29.4 12.9a10.4 10.4 0 0 1 0 14.2"
        stroke="#ffffff"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* 成果 */}
      <circle cx="31.5" cy="9.2" r="2.5" fill="var(--color-accent-500)" />
    </svg>
  );
}

export function Logo({
  size = 30,
  showTagline = false,
  className = "",
}: {
  size?: number;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="leading-none">
        <span
          className="block font-bold tracking-tight text-[var(--text)]"
          style={{ fontSize: Math.round(size * 0.56) }}
        >
          AI広報
        </span>
        {showTagline && (
          <span
            className="block muted mt-1 tracking-wide"
            style={{ fontSize: Math.round(size * 0.3) }}
          >
            成果を出すAI広報部
          </span>
        )}
      </span>
    </span>
  );
}
