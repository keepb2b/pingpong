import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser, supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Logo } from "@/components/Logo";
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
    <div className="min-h-dvh bg-[var(--surface-2)]">
      {/* 運営用であることが一目で分かるよう、ヘッダーの色を変える */}
      <header className="bg-ink-900 text-white border-b-[3px] border-[var(--color-accent-500)]">
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
          <div className="h-14 flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Logo size={26} className="[&_span]:text-white" />
              <span className="px-1.5 py-0.5 rounded-[2px] bg-[var(--color-accent-500)] text-[10px] font-bold tracking-wide">
                運営管理
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-4 text-[12px]">
              <span className="hidden sm:inline text-white/70 tabular-nums">
                登録ユーザー {userCount ?? 0}名
              </span>
              <span className="hidden sm:inline text-white/90">
                {profile.display_name ?? profile.email}
              </span>
              <Link href="/dashboard" className="text-white/80 hover:text-white hover:underline">
                管理画面へ戻る
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-white/80 hover:text-white hover:underline">
                  ログアウト
                </button>
              </form>
            </div>
          </div>

          <AdminNav />
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 sm:px-6 py-6">{children}</main>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 mt-8">
        <p className="text-[11px] muted text-center">AI広報 運営管理システム</p>
      </footer>
    </div>
  );
}
