"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Home,
  Inbox,
  Target,
  FileText,
  CalendarDays,
  BarChart3,
  Gauge,
  ClipboardList,
  MessageSquare,
  Radar,
  AlertTriangle,
  Newspaper,
  BookOpen,
  Shield,
  Brain,
  Settings,
  CreditCard,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: "pending" | "mentions";
};

const ICON = { size: 18, strokeWidth: 1.75 } as const;

const GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "広報活動",
    items: [
      { href: "/dashboard", label: "ホーム", icon: <Home {...ICON} /> },
      { href: "/dashboard/intake", label: "広報材料・AI取材", icon: <Inbox {...ICON} /> },
      { href: "/dashboard/strategy", label: "戦略", icon: <Target {...ICON} /> },
      { href: "/dashboard/content", label: "コンテンツ", icon: <FileText {...ICON} />, badge: "pending" },
      { href: "/dashboard/calendar", label: "投稿予定", icon: <CalendarDays {...ICON} /> },
    ],
  },
  {
    title: "成果",
    items: [
      { href: "/dashboard/analytics", label: "成果分析", icon: <BarChart3 {...ICON} /> },
      { href: "/dashboard/score", label: "AI広報スコア", icon: <Gauge {...ICON} /> },
      { href: "/dashboard/reports", label: "月次AI広報会議", icon: <ClipboardList {...ICON} /> },
    ],
  },
  {
    title: "リスク・市場",
    items: [
      { href: "/dashboard/mentions", label: "コメント・口コミ", icon: <MessageSquare {...ICON} />, badge: "mentions" },
      { href: "/dashboard/monitoring", label: "競合・市場監視", icon: <Radar {...ICON} /> },
      { href: "/dashboard/crisis", label: "危機広報", icon: <AlertTriangle {...ICON} /> },
      { href: "/dashboard/media", label: "メディアリレーション", icon: <Newspaper {...ICON} /> },
    ],
  },
  {
    title: "その他",
    items: [
      { href: "/dashboard/karte", label: "AI広報カルテ", icon: <BookOpen {...ICON} /> },
      { href: "/dashboard/facts", label: "公式事実データベース", icon: <Shield {...ICON} /> },
      { href: "/dashboard/learnings", label: "AIが学習した内容", icon: <Brain {...ICON} /> },
    ],
  },
  {
    title: "設定",
    items: [
      { href: "/dashboard/settings", label: "設定", icon: <Settings {...ICON} /> },
      { href: "/dashboard/billing", label: "ご契約・料金", icon: <CreditCard {...ICON} /> },
    ],
  },
];

function NavLinks({
  pending,
  mentions,
  isPlatformAdmin,
  onNavigate,
  dark = false,
}: {
  pending: number;
  mentions: number;
  isPlatformAdmin?: boolean;
  onNavigate?: () => void;
  dark?: boolean;
}) {
  const pathname = usePathname();

  const groups = isPlatformAdmin
    ? [
        ...GROUPS,
        {
          title: "運営",
          items: [{ href: "/admin", label: "運営管理", icon: <ShieldCheck {...ICON} /> }] as NavItem[],
        },
      ]
    : GROUPS;

  return (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p
            className={`px-3 mb-1.5 text-[11px] font-semibold tracking-wide ${
              dark ? "text-[var(--sidebar-muted)]" : "muted"
            }`}
          >
            {g.title}
          </p>
          <ul className="space-y-0.5">
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
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 mx-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors
                      ${
                        dark
                          ? active
                            ? "bg-[var(--sidebar-active)] text-white font-semibold"
                            : "text-[var(--sidebar-text)] hover:bg-white/10 hover:text-white"
                          : active
                            ? "bg-brand-50 text-brand-800 font-semibold"
                            : "muted hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                      }`}
                  >
                    <span className="shrink-0 opacity-90">{item.icon}</span>
                    <span className="truncate flex-1">{item.label}</span>
                    {count > 0 && (
                      <span
                        className={`shrink-0 min-w-[18px] h-[18px] px-1 rounded-md text-[10px] font-bold grid place-items-center tabular-nums ${
                          dark ? "bg-amber-400 text-ink-900" : "bg-amber-500 text-white"
                        }`}
                      >
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
  return <NavLinks {...props} dark />;
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
        className="p-2 -ml-2 muted hover:text-[var(--text)] rounded-lg"
        aria-label="メニューを開く"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="w-[17.5rem] h-full bg-[var(--sidebar)] overflow-y-auto scroll-thin"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
              <span className="font-semibold text-[13px] text-white">メニュー</span>
              <button onClick={() => setOpen(false)} className="text-white/70 p-1" aria-label="閉じる">
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="py-3">
              <NavLinks
                pending={pending}
                mentions={mentions}
                isPlatformAdmin={isPlatformAdmin}
                onNavigate={() => setOpen(false)}
                dark
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
