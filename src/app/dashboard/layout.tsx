import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Logo, LogoMark } from "@/components/Logo";
import { SidebarNav, MobileNav } from "@/components/dashboard/Nav";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { SubjectSwitcher } from "@/components/dashboard/SubjectSwitcher";
import { AccountMenu } from "@/components/dashboard/AccountMenu";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
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

  const isPlatformAdmin = Boolean(profile?.is_platform_admin);

  return (
    <div className="min-h-dvh flex bg-[var(--surface-2)]">
      {/* --------------------------------------------------------- サイド -- */}
      <aside className="hidden lg:flex w-[15rem] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] sticky top-0 h-dvh">
        <div className="h-14 flex items-center px-4 border-b-[3px] border-brand-600">
          <Link href="/dashboard">
            <Logo size={26} />
          </Link>
        </div>

        <div className="p-3 border-b border-[var(--border)]">
          <SubjectSwitcher subjects={subjects ?? []} activeId={ctx.subjectId} />
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin py-3">
          <SidebarNav
            pending={pendingCount ?? 0}
            mentions={mentionCount ?? 0}
            isPlatformAdmin={isPlatformAdmin}
          />
        </div>

        <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-2)]">
          <p className="text-[11px] muted truncate">{org?.name ?? ctx.orgName}</p>
        </div>
      </aside>

      {/* ----------------------------------------------------------- 本体 -- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-3 sm:px-5 bg-[var(--surface)] border-b border-[var(--border)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="lg:hidden">
            <MobileNav
              pending={pendingCount ?? 0}
              mentions={mentionCount ?? 0}
              isPlatformAdmin={isPlatformAdmin}
            />
          </div>
          <Link href="/dashboard" className="lg:hidden flex items-center gap-2">
            <LogoMark size={24} />
            <span className="font-bold text-[14px]">AI広報</span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell notifications={notifications ?? []} />
            <span className="w-px h-6 bg-[var(--border)]" aria-hidden />
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
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full">{children}</main>

        <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <p className="text-[11px] muted text-center">
            AI広報 — 成果を出すAI広報部
          </p>
        </footer>
      </div>
    </div>
  );
}
