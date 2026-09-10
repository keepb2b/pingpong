import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, Badge, EmptyState } from "@/components/ui";
import { statusTone, riskTone } from "@/lib/badge-tone";
import { PageHeader, formatDateTime } from "@/components/dashboard/shared";
import { ContentToolbar } from "./Toolbar";
import { CONTENT_TYPE_LABEL, STATUS_LABEL, RISK_LABEL, GOAL_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const { status, type } = await searchParams;
  const sb = await supabaseServer();

  let query = sb
    .from("content_items")
    .select("id, title, summary, type, status, risk, goal, created_at, version")
    .eq("subject_id", ctx.subjectId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);

  const [{ data: items }, { data: all }] = await Promise.all([
    query,
    sb.from("content_items").select("status").eq("subject_id", ctx.subjectId),
  ]);

  const counts: Record<string, number> = {};
  for (const c of all ?? []) counts[c.status] = (counts[c.status] ?? 0) + 1;

  return (
    <>
      <PageHeader
        title="コンテンツ"
        description="AIライターが制作し、AIマーケターが媒体別に最適化し、AIアナリストが検査した広報コンテンツです。"
        agent="writer"
      />

      <ContentToolbar counts={counts} total={all?.length ?? 0} subjectId={ctx.subjectId} />

      {!items?.length ? (
        <Card className="mt-4">
          <EmptyState
            title="コンテンツがありません"
            body="ホームの「今日の広報活動を実行」を押すか、広報材料から制作を依頼してください。"
          />
        </Card>
      ) : (
        <ul className="mt-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/content/${c.id}`}
                className="card p-4 block h-full hover:border-brand-300 hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                  {c.risk !== "none" && <Badge tone={riskTone(c.risk)}>{RISK_LABEL[c.risk]}</Badge>}
                </div>

                <p className="text-sm font-medium leading-snug line-clamp-2">{c.title}</p>
                {c.summary && (
                  <p className="muted text-xs mt-1.5 line-clamp-3 leading-relaxed">{c.summary}</p>
                )}

                <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-2 text-[11px] muted">
                  <span>{CONTENT_TYPE_LABEL[c.type as keyof typeof CONTENT_TYPE_LABEL] ?? c.type}</span>
                  {c.goal && <span>· {GOAL_LABEL[c.goal as keyof typeof GOAL_LABEL]}</span>}
                  {c.version > 1 && <span>· v{c.version}</span>}
                  <span className="ml-auto tabular-nums">{formatDateTime(c.created_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
