"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Layers, CreditCard, LogIn, UserPlus, Settings, Menu } from "lucide-react";
import { DashboardBrand } from "./Brand";

const links = [
  { href: "/", label: "AI広報部について", icon: Home },
  { href: "/#agents", label: "AIチーム", icon: Users },
  { href: "/#features", label: "機能一覧", icon: Layers },
  { href: "/#pricing", label: "料金プラン", icon: CreditCard },
  { href: "/login", label: "ログイン", icon: LogIn },
  { href: "/signup", label: "新規登録", icon: UserPlus },
  { href: "/onboarding", label: "初期設定", icon: Settings },
];

export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navigation = (
    <nav aria-label="サイトナビゲーション" className="public-navigation">
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
          onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>
          <Icon size={17} strokeWidth={1.75} /><span>{label}</span>
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="dashboard-shell public-shell">
      <aside className="dashboard-sidebar public-sidebar">
        <Link href="/" className="dashboard-brand"><DashboardBrand /></Link>
        <p className="public-nav-caption">AI広報部</p>
        {navigation}
        <p className="public-sidebar-note">AIとともに、日々の広報を。</p>
      </aside>
      <div className={`public-content ${pathname === "/" ? "public-marketing" : "public-form-page"}`}>
        <details className="public-mobile-nav">
          <summary><Menu size={20} /><span>メニュー</span></summary>
          {navigation}
        </details>
        {children}
      </div>
    </div>
  );
}
