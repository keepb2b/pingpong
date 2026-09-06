"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; badge?: "pending" | "mentions" };

const GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "広報活動",
    items: [
      { href: "/dashboard", label: "ホーム" },
      { href: "/dashboard/intake", label: "広報材料・AI取材" },
      { href: "/dashboard/strategy", label: "戦略" },
      { href: "/dashboard/content", label: "コンテンツ", badge: "pending" },
      { href: "/dashboard/calendar", label: "投稿予定" },
    ],
  },
  {
    title: "成果",
    items: [
      { href: "/dashboard/analytics", label: "成果分析" },
      { href: "/dashboard/score", label: "AI広報スコア" },
      { href: "/dashboard/reports", label: "月次AI広報会議" },
    ],
  },
  {
    title: "信頼・リスク",
    items: [
      { href: "/dashboard/mentions", label: "コメント・口コミ", badge: "mentions" },
      { href: "/dashboard/monitoring", label: "競合・市場監視" },
      { href: "/dashboard/crisis", label: "危機広報" },
      { href: "/dashboard/media", label: "メディアリレーション" },
    ],
  },
  {
    title: "AIの理解",
    items: [
      { href: "/dashboard/karte", label: "AI広報カルテ" },
      { href: "/dashboard/facts", label: "公式事実データベース" },
      { href: "/dashboard/learnings", label: "AIが学習した内容" },
    ],
  },
  {
    title: "設定",
    items: [
      { href: "/dashboard/settings", label: "設定・連携" },
      { href: "/dashboard/billing", label: "ご契約・料金" },
    ],
  },
];

function NavLinks({
  pending,
  mentions,
  onNavigate,
}: {
  pending: number;
  mentions: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-5">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider muted">
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
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[13px] transition-colors
                      ${
                        active
                          ? "bg-brand-50 text-brand-700 font-medium dark:bg-brand-900/30 dark:text-brand-200"
                          : "muted hover:text-[var(--text)] hover:bg-[var(--surface-3)]"
                      }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {count > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold grid place-items-center tabular-nums">
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

export function SidebarNav(props: { pending: number; mentions: number }) {
  return <NavLinks {...props} />;
}

export function MobileNav({ pending, mentions }: { pending: number; mentions: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 -ml-2 muted hover:text-[var(--text)]"
        aria-label="メニューを開く"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-72 h-full bg-[var(--surface)] border-r border-[var(--border)] p-4 overflow-y-auto scroll-thin animate-[rise_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="font-bold text-sm">メニュー</span>
              <button onClick={() => setOpen(false)} className="muted p-1" aria-label="閉じる">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks pending={pending} mentions={mentions} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
