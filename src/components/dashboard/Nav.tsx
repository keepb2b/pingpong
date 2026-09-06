"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  HomeIcon,
  InboxIcon,
  TargetIcon,
  DocumentIcon,
  CalendarIcon,
  ChartIcon,
  GaugeIcon,
  ReportIcon,
  CommentIcon,
  MonitorIcon,
  AlertTriangleIcon,
  NewspaperIcon,
  ClipboardIcon,
  ShieldIcon,
  BrainIcon,
  SettingsIcon,
  CardIcon,
  AdminIcon,
} from "@/components/icons/NavIcons";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: "pending" | "mentions";
};

const GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "広報活動",
    items: [
      { href: "/dashboard", label: "ホーム", icon: <HomeIcon /> },
      { href: "/dashboard/intake", label: "広報材料・AI取材", icon: <InboxIcon /> },
      { href: "/dashboard/strategy", label: "戦略", icon: <TargetIcon /> },
      { href: "/dashboard/content", label: "コンテンツ", icon: <DocumentIcon />, badge: "pending" },
      { href: "/dashboard/calendar", label: "投稿予定", icon: <CalendarIcon /> },
    ],
  },
  {
    title: "成果",
    items: [
      { href: "/dashboard/analytics", label: "成果分析", icon: <ChartIcon /> },
      { href: "/dashboard/score", label: "AI広報スコア", icon: <GaugeIcon /> },
      { href: "/dashboard/reports", label: "月次AI広報会議", icon: <ReportIcon /> },
    ],
  },
  {
    title: "信頼・リスク",
    items: [
      { href: "/dashboard/mentions", label: "コメント・口コミ", icon: <CommentIcon />, badge: "mentions" },
      { href: "/dashboard/monitoring", label: "競合・市場監視", icon: <MonitorIcon /> },
      { href: "/dashboard/crisis", label: "危機広報", icon: <AlertTriangleIcon /> },
      { href: "/dashboard/media", label: "メディアリレーション", icon: <NewspaperIcon /> },
    ],
  },
  {
    title: "AIの理解",
    items: [
      { href: "/dashboard/karte", label: "AI広報カルテ", icon: <ClipboardIcon /> },
      { href: "/dashboard/facts", label: "公式事実データベース", icon: <ShieldIcon /> },
      { href: "/dashboard/learnings", label: "AIが学習した内容", icon: <BrainIcon /> },
    ],
  },
  {
    title: "設定",
    items: [
      { href: "/dashboard/settings", label: "設定・連携", icon: <SettingsIcon /> },
      { href: "/dashboard/billing", label: "ご契約・料金", icon: <CardIcon /> },
    ],
  },
];

function NavLinks({
  pending,
  mentions,
  isPlatformAdmin,
  onNavigate,
}: {
  pending: number;
  mentions: number;
  isPlatformAdmin?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const groups = isPlatformAdmin
    ? [
        ...GROUPS,
        {
          title: "運営",
          items: [{ href: "/admin", label: "運営管理", icon: <AdminIcon /> }] as NavItem[],
        },
      ]
    : GROUPS;

  return (
    <nav className="space-y-4">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-2 mb-1 text-[11px] font-bold text-[var(--text-muted)] border-l-[3px] border-[var(--border-strong)] pl-2">
            {g.title}
          </p>
          <ul>
            {g.items.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              const count =
                item.badge === "pending" ? pending : item.badge === "mentions" ? mentions : 0;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 px-2 py-[7px] text-[13px] border-l-[3px] transition-colors
                      ${
                        active
                          ? "border-l-brand-600 bg-brand-50 text-brand-700 font-semibold dark:bg-brand-900/30 dark:text-brand-100"
                          : "border-l-transparent muted hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                      }`}
                  >
                    <span className="shrink-0 opacity-90">{item.icon}</span>
                    <span className="truncate flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[17px] px-1 rounded-[2px] bg-[var(--color-accent-500)] text-white text-[10px] font-bold grid place-items-center tabular-nums">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SidebarNav(props: {
  pending: number;
  mentions: number;
  isPlatformAdmin?: boolean;
}) {
  return <NavLinks {...props} />;
}

export function MobileNav({
  pending,
  mentions,
  isPlatformAdmin,
}: {
  pending: number;
  mentions: number;
  isPlatformAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 -ml-2 muted hover:text-[var(--text)]"
        aria-label="メニューを開く"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="w-[17rem] h-full bg-[var(--surface)] border-r border-[var(--border)] overflow-y-auto scroll-thin"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-12 band">
              <span className="font-bold text-[13px]">メニュー</span>
              <button onClick={() => setOpen(false)} className="text-white/80 p-1" aria-label="閉じる">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-3">
              <NavLinks
                pending={pending}
                mentions={mentions}
                isPlatformAdmin={isPlatformAdmin}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
