import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser, supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DashboardBrand } from "@/components/dashboard/Brand";
import { AdminNav } from "./Nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");

  // 運営管理者以外は管理画面へ入れない
  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("display_name, email, is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_platform_admin) redirect("/dashboard");

  // 表示用に軽い統計だけ取っておく
  const sb = await supabaseServer();
  const { count: userCount } = await supabaseAdmin()
    .from("profiles")
    .select("id", { count: "exact", head: true });
  void sb;

  return (
    <div className="dashboard-shell admin-shell min-h-dvh">
      <aside className="dashboard-sidebar admin-sidebar">
        <Link href="/admin" className="dashboard-brand"><DashboardBrand /></Link>
        <AdminNav />
      </aside>
      <div className="min-w-0 flex-1">
      <header className="admin-header">
        <div className="px-4 sm:px-6">
          <div className="h-14 flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/admin" className="flex items-center gap-2.5 min-w-0">
              <DashboardBrand />
              <span className="px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[10px] font-semibold tracking-wide">
                運営管理
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-2 sm:gap-4 text-[11px] sm:text-[12px] shrink-0">
              <span className="hidden sm:inline muted tabular-nums">
                登録ユーザー {userCount ?? 0}名
              </span>
              <span className="hidden sm:inline text-[var(--text-muted)]">
                {profile.display_name ?? profile.email}
              </span>
              <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-brand-600">
                管理画面へ戻る
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-[var(--text-muted)] hover:text-brand-600">
                  ログアウト
                </button>
              </form>
            </div>
          </div>

          <div className="admin-mobile-navigation"><AdminNav /></div>
        </div>
      </header>

      <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
