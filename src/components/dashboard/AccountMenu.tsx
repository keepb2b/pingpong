"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar, Badge } from "@/components/ui";
import { UserIcon, SettingsIcon, AdminIcon, LogoutIcon, CardIcon } from "@/components/icons/NavIcons";
import { ROLE_LABEL } from "@/lib/constants";

export type HeaderProfile = {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  jobTitle: string | null;
  department: string | null;
  orgName: string | null;
  orgRole: string | null;
  isPlatformAdmin: boolean;
};

/**
 * ヘッダーのアカウント表示。
 * アバターをクリックすると、プロフィールの確認と各設定への導線を開く。
 */
export function AccountMenu({ profile }: { profile: HeaderProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = profile.displayName ?? profile.email ?? "ユーザー";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-[3px] border border-transparent
          hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)] transition-colors"
      >
        <Avatar src={profile.avatarUrl} name={name} size={30} />
        <span className="hidden sm:block text-left leading-tight max-w-[11rem]">
          <span className="block text-[12.5px] font-semibold truncate">{name}</span>
          <span className="block text-[11px] muted truncate">
            {profile.orgName ?? profile.companyName ?? "—"}
          </span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={`muted shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-[19rem] card z-50 shadow-xl overflow-hidden
            animate-[rise_0.16s_cubic-bezier(0.22,1,0.36,1)]"
        >
          {/* プロフィール概要 */}
          <div className="p-4 bg-[var(--surface-2)] border-b border-[var(--border)]">
            <div className="flex items-start gap-3">
              <Avatar src={profile.avatarUrl} name={name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold truncate">{name}</p>
                <p className="text-[11.5px] muted truncate">{profile.email}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {profile.orgRole && (
                    <Badge tone="brand">{ROLE_LABEL[profile.orgRole] ?? profile.orgRole}</Badge>
                  )}
                  {profile.isPlatformAdmin && <Badge tone="bad">運営管理者</Badge>}
                </div>
              </div>
            </div>

            {(profile.department || profile.jobTitle) && (
              <p className="mt-2.5 text-[11.5px] muted">
                {[profile.department, profile.jobTitle].filter(Boolean).join(" / ")}
              </p>
            )}
          </div>

          {/* 導線 */}
          <ul className="py-1">
            {[
              { href: "/dashboard/account", label: "アカウント情報を編集", icon: <UserIcon /> },
              { href: "/dashboard/account#profile", label: "プロフィール詳細", icon: <ClipboardSmall /> },
              { href: "/dashboard/settings", label: "設定・連携", icon: <SettingsIcon /> },
              { href: "/dashboard/billing", label: "ご契約・料金", icon: <CardIcon /> },
              ...(profile.isPlatformAdmin
                ? [{ href: "/admin", label: "運営管理ページ", icon: <AdminIcon /> }]
                : []),
            ].map((item) => (
              <li key={item.href + item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] hover:bg-[var(--surface-3)] transition-colors"
                >
                  <span className="muted shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <form action="/auth/signout" method="post" className="border-t border-[var(--border)]">
            <button
              type="submit"
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] text-left
                hover:bg-[var(--surface-3)] transition-colors muted hover:text-[var(--text)]"
            >
              <LogoutIcon />
              ログアウト
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ClipboardSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="9" y="3" width="6" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
