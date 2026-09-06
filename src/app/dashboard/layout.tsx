import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { SparkIcon } from "@/components/icons/AgentIcons";
import { SidebarNav, MobileNav } from "@/components/dashboard/Nav";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { SubjectSwitcher } from "@/components/dashboard/SubjectSwitcher";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");

  const sb = await supabaseServer();

  const [{ data: subjects }, { data: notifications }, { data: org }] = await Promise.all([
    sb
      .from("subjects")
      .select("id, name, type, is_primary")
      .eq("org_id", ctx.orgId)
      .eq("active", true)
      .order("is_primary", { ascending: false }),
    sb
      .from("notifications")
      .select("id, title, body, link, kind, created_at, read_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(20),
    sb.from("organizations").select("name, onboarded_at").eq("id", ctx.orgId).maybeSingle(),
  ]);

  const [{ count: pendingCount }, { count: mentionCount }] = await Promise.all([
    sb
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ctx.orgId)
      .eq("status", "pending_approval"),
    sb
      .from("mentions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ctx.orgId)
      .in("status", ["new", "drafted"]),
  ]);

  return (
    <div className="min-h-dvh flex">
      {/* ---------------------------------------------------------- sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] sticky top-0 h-dvh">
        <div className="h-14 flex items-center px-5 border-b border-[var(--border)]">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-sm">
            <span className="text-brand-600">
              <SparkIcon size={18} />
            </span>
            AI広報
          </Link>
        </div>

        <div className="p-3 border-b border-[var(--border)]">
          <SubjectSwitcher subjects={subjects ?? []} activeId={ctx.subjectId} />
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin p-3">
          <SidebarNav pending={pendingCount ?? 0} mentions={mentionCount ?? 0} />
        </div>

        <div className="p-3 border-t border-[var(--border)]">
          <p className="text-[11px] muted truncate px-2">{org?.name ?? ctx.orgName}</p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="mt-1 w-full text-left px-2 py-1.5 text-xs muted hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-3)]"
            >
              ログアウト
            </button>
          </form>
        </div>
      </aside>

      {/* ------------------------------------------------------------- main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 sm:px-6 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md">
          <div className="lg:hidden">
            <MobileNav pending={pendingCount ?? 0} mentions={mentionCount ?? 0} />
          </div>
          <div className="lg:hidden font-bold text-sm flex items-center gap-2">
            <span className="text-brand-600">
              <SparkIcon size={16} />
            </span>
            AI広報
          </div>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell notifications={notifications ?? []} />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full">{children}</main>
      </div>
    </div>
  );
}
