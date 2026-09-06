/* ==========================================================================
   ナビゲーション用アイコン
   線幅1.6の統一された線画。装飾的な効果は付けない。
   ========================================================================== */

type Props = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** ホーム */
export function HomeIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.6V20h12V9.6" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

/** 広報材料・AI取材 (受信箱) */
export function InboxIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 13.5 5.5 5h13L21 13.5V19H3z" />
      <path d="M3 13.5h5l1 2.5h6l1-2.5h5" />
    </svg>
  );
}

/** 戦略 (的) */
export function TargetIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** コンテンツ (書類) */
export function DocumentIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

/** 投稿予定 (カレンダー) */
export function CalendarIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      <path d="M7.5 13h3v3h-3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 成果分析 (折れ線) */
export function ChartIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 4v16h16" />
      <path d="M7.5 15l3.5-4 3 2.5L20 7" />
    </svg>
  );
}

/** スコア (メーター) */
export function GaugeIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17l4.2-4.4" />
      <circle cx="12" cy="17" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 月次会議 (レポート) */
export function ReportIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
      <path d="M8 12v4.5M12 9v7.5M16 14v2.5" />
      <path d="M8 6.5h8" />
    </svg>
  );
}

/** コメント・口コミ */
export function CommentIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 5.5h16v11H12l-5 3.5v-3.5H4z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

/** 競合・市場監視 (双眼鏡) */
export function MonitorIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="6.5" cy="15" r="3.5" />
      <circle cx="17.5" cy="15" r="3.5" />
      <path d="M10 15h4" />
      <path d="M6.5 11.5 8 5h3v6.5M17.5 11.5 16 5h-3v6.5" />
    </svg>
  );
}

/** 危機広報 (警告) */
export function AlertTriangleIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 4 2.8 20h18.4z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.3" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** メディアリレーション (新聞) */
export function NewspaperIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 6h12v14H4z" />
      <path d="M16 9h4v9a2 2 0 0 1-2 2h-2" />
      <path d="M7 9.5h6M7 13h6M7 16.5h4" />
    </svg>
  );
}

/** AI広報カルテ (バインダー) */
export function ClipboardIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15" />
      <rect x="9" y="3" width="6" height="3.2" rx="0.8" />
      <path d="M8.5 11h7M8.5 15h5" />
    </svg>
  );
}

/** 公式事実 (盾チェック) */
export function ShieldIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3 5 5.8v5.4c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V5.8z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </svg>
  );
}

/** AI学習内容 (記憶) */
export function BrainIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9.5 4.5A2.5 2.5 0 0 0 7 7a2.5 2.5 0 0 0-1.5 4.5A2.5 2.5 0 0 0 7 16v.5a2.5 2.5 0 0 0 4.5 1.5V5.6a2.5 2.5 0 0 0-2-1.1Z" />
      <path d="M14.5 4.5A2.5 2.5 0 0 1 17 7a2.5 2.5 0 0 1 1.5 4.5A2.5 2.5 0 0 1 17 16v.5a2.5 2.5 0 0 1-4.5 1.5" />
    </svg>
  );
}

/** 設定 (歯車) */
export function SettingsIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
    </svg>
  );
}

/** ご契約・料金 (カード) */
export function CardIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3 9.8h18" />
      <path d="M6.5 14.5h3" />
    </svg>
  );
}

/** 運営管理 (鍵付き) */
export function AdminIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3l7 3v5.2c0 4.4-2.9 8.4-7 9.8-4.1-1.4-7-5.4-7-9.8V6z" />
      <circle cx="12" cy="11" r="1.8" />
      <path d="M12 12.8V16" />
    </svg>
  );
}

/** ユーザー */
export function UserIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" />
    </svg>
  );
}

/** 通知 (ベル) */
export function BellIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.4 5.3 1.4 5.3H5.1s1.4-1.3 1.4-5.3Z" />
      <path d="M10.2 18.3a1.9 1.9 0 0 0 3.6 0" />
    </svg>
  );
}

/** 表示 (目) */
export function EyeIcon({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** 非表示 (目に斜線) */
export function EyeOffIcon({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3.2 3.9" />
      <path d="M6.4 7.6A17.4 17.4 0 0 0 2.5 12S6 18.2 12 18.2c1.6 0 3-.4 4.2-1" />
      <path d="M10 10a2.8 2.8 0 0 0 4 4" />
      <path d="m3.5 3.5 17 17" />
    </svg>
  );
}

/** カメラ (アバター用) */
export function CameraIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.5 8.5h3.2l1.5-2.3h7.6l1.5 2.3h3.2v10H3.5z" />
      <circle cx="12" cy="13" r="3.3" />
    </svg>
  );
}

/** ログアウト */
export function LogoutIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 4.5h4.5A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </svg>
  );
}
