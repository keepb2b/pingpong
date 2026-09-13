"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, CreditCard, BarChart3 } from "lucide-react";

const ICON = { size: 16, strokeWidth: 1.75 } as const;

const TABS = [
  { href: "/admin", label: "ユーザー管理", icon: <Users {...ICON} /> },
  { href: "/admin/payments", label: "決済履歴", icon: <CreditCard {...ICON} /> },
  { href: "/admin/activity", label: "利用状況", icon: <BarChart3 {...ICON} /> },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 px-2 pb-2 overflow-x-auto scroll-thin">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors
              ${active ? "bg-[var(--sidebar-active)] text-white" : "text-[var(--sidebar-text)] hover:bg-white/10 hover:text-white"}`}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
