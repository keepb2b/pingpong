"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserIcon, CardIcon, ChartIcon } from "@/components/icons/NavIcons";

const TABS = [
  { href: "/admin", label: "ユーザー管理", icon: <UserIcon /> },
  { href: "/admin/payments", label: "決済履歴", icon: <CardIcon /> },
  { href: "/admin/activity", label: "利用状況", icon: <ChartIcon /> },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-0.5 -mb-px overflow-x-auto scroll-thin">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap
              border-b-[3px] transition-colors
              ${
                active
                  ? "border-b-[var(--color-accent-500)] text-white"
                  : "border-b-transparent text-white/60 hover:text-white"
              }`}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
