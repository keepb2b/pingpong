import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { SidebarNav, MobileNav } from "@/components/dashboard/Nav";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { SubjectSwitcher } from "@/components/dashboard/SubjectSwitcher";
import { AccountMenu } from "@/components/dashboard/AccountMenu";
import { RefreshOnFocus } from "@/components/dashboard/RefreshOnFocus";
import { HeaderSearch } from "@/components/dashboard/HeaderSearch";
import { DashboardMark } from "@/components/dashboard/Brand";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (err) {
    console.error("[dashboard layout] getOrgContext", err);
    throw err;
  }
  if (!ctx) redirect("/onboarding");

  const sb = await supabaseServer();

  const [{ data: subjects }, { data: notifications }, { data: org }, { data: profile }] =
    await Promise.all([
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
      sb
        .from("profiles")
        .select("id, display_name, email, avatar_url, company_name, job_title, department, is_platform_admin")
        .eq("id", ctx.userId)
        .maybeSingle(),
    ]);

  const pendingQuery = sb
    .from("content_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.orgId)
    .eq("status", "pending_approval");
  if (ctx.subjectId) pendingQuery.eq("subject_id", ctx.subjectId);

  const [{ count: pendingCount }, { count: mentionCount }] = await Promise.all([
    pendingQuery,
    sb
      .from("mentions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ctx.orgId)
      .in("status", ["new", "drafted"]),
  ]);

  const isPlatformAdmin = Boolean(profile?.is_platform_admin);

  return (
    <div className="dashboard-shell min-h-dvh flex bg-[var(--surface-2)]">
      <RefreshOnFocus />
      <aside className="dashboard-sidebar hidden lg:flex w-[14rem] shrink-0 flex-col bg-[var(--sidebar)] sticky top-0 h-dvh">
        <div className="dashboard-brand h-16 flex items-center gap-2.5 px-5">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <DashboardMark />
            <span className="text-white text-[18px] font-semibold tracking-wide truncate">AI広報部</span>
          </Link>
        </div>

        <div className="dashboard-subject px-3 pb-2">
          <SubjectSwitcher subjects={subjects ?? []} activeId={ctx.subjectId} tone="dark" />
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin py-3">
          <SidebarNav
            pending={pendingCount ?? 0}
            mentions={mentionCount ?? 0}
            isPlatformAdmin={isPlatformAdmin}
          />
        </div>

        <div className="p-3 border-t border-white/10">
          <p className="text-[11px] font-medium text-white/90 truncate">{org?.name ?? ctx.orgName}</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--border)]">
          <div className="h-14 flex items-center gap-2 sm:gap-3 px-3 sm:px-6">
            <div className="lg:hidden shrink-0">
              <MobileNav
                pending={pendingCount ?? 0}
                mentions={mentionCount ?? 0}
                isPlatformAdmin={isPlatformAdmin}
              />
            </div>
            <Link href="/dashboard" className="lg:hidden flex items-center gap-2 min-w-0">
              <DashboardMark size={22} />
              <span className="font-semibold text-[14px] truncate">AI広報部</span>
            </Link>

            <div className="hidden sm:block flex-1 min-w-0">
              <HeaderSearch />
            </div>

            <div className="ml-auto flex items-center gap-1 sm:gap-2 min-w-0 shrink-0">
              <NotificationBell notifications={notifications ?? []} />
              <AccountMenu
                profile={{
                  id: ctx.userId,
                  displayName: profile?.display_name ?? null,
                  email: profile?.email ?? null,
                  avatarUrl: profile?.avatar_url ?? null,
                  companyName: profile?.company_name ?? null,
                  jobTitle: profile?.job_title ?? null,
                  department: profile?.department ?? null,
                  orgName: org?.name ?? ctx.orgName,
                  orgRole: ctx.role,
                  isPlatformAdmin,
                }}
              />
            </div>
          </div>
          <div className="sm:hidden px-3 pb-3">
            <HeaderSearch />
          </div>
        </header>

        <main className="dashboard-main flex-1 w-full">{children}</main>
      </div>
    </div>
  );
}
