import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { PageHeader, AgentButton, ActionButton } from "@/components/dashboard/shared";
import { AGENTS } from "@/lib/constants";
import { AgentIcon } from "@/components/icons/AgentIcons";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const { period: requested } = await searchParams;
  const sb = await supabaseServer();

  const { data: reports } = await sb
    .from("monthly_reports")
    .select("*")
    .eq("subject_id", ctx.subjectId)
    .order("period", { ascending: false })
    .limit(12);

  const report = requested ? reports?.find((r) => r.period === requested) : reports?.[0];

  const prev = new Date();
  prev.setMonth(prev.getMonth() - 1);
  const lastPeriod = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        title="月次AI広報会議"
        description="毎月、AI広報チームが活動結果をまとめます。成果が出た理由だけでなく、出なかった理由も具体的に示します。"
        agent="analyst"
        action={
          <AgentButton
            label={`${lastPeriod}の会議資料を作る`}
            body={{ action: "monthly_review", subjectId: ctx.subjectId, period: lastPeriod }}
            successMessage="月次レポートを作成しました"
          />
        }
      />

      {!report ? (
        <Card>
          <EmptyState
            title="まだレポートがありません"
            body="月末に自動作成されます。今すぐ作る場合は上のボタンを押してください。"
          />
        </Card>
      ) : (
        <>
          {reports && reports.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {reports.map((r) => (
                <a
                  key={r.period}
                  href={`/dashboard/reports?period=${r.period}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                    ${
                      r.period === report.period
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                        : "border-[var(--border)] muted hover:border-brand-300"
                    }`}
                >
                  {r.period}
                </a>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardHeader
                  title={`${report.period} 総括`}
                  action={
                    report.status === "approved" ? (
                      <Badge tone="good">承認済み</Badge>
                    ) : (
                      <ActionButton
                        label="来月の方針を承認"
                        path="/api/workflow"
                        body={{ action: "approve_report", id: report.id }}
                        variant="primary"
                      />
                    )
                  }
                />
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.summary}</p>
              </Card>

              <ReportList
                title="KPIの達成状況"
                rows={report.kpi_status as Row[]}
                render={(r) => (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{String(r.name ?? "")}</p>
                      {r.comment ? (
                        <p className="muted text-[11px] mt-0.5 leading-relaxed">{String(r.comment)}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs tabular-nums font-semibold">
                        {String(r.actual ?? 0)} / {String(r.target ?? 0)}
                      </p>
                      <Badge tone={r.achieved ? "good" : "warn"}>
                        {r.achieved ? "達成" : "未達"}
                      </Badge>
                    </div>
                  </div>
                )}
              />

              <ReportList
                title="伸びたコンテンツと理由"
                rows={report.top_content as Row[]}
                render={(r) => (
                  <>
                    <p className="text-xs font-medium">{String(r.title ?? "")}</p>
                    <p className="muted text-[11px] mt-1 leading-relaxed">{String(r.why ?? "")}</p>
                    {r.metric ? (
                      <p className="text-[11px] text-emerald-600 mt-1">{String(r.metric)}</p>
                    ) : null}
                  </>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-5">
                <ReportList
                  title="成果が出た理由"
                  rows={report.wins as Row[]}
                  render={(r) => (
                    <p className="text-xs leading-relaxed">{String(r.point ?? JSON.stringify(r))}</p>
                  )}
                />
                <ReportList
                  title="成果が出なかった理由"
                  rows={report.losses as Row[]}
                  render={(r) => (
                    <>
                      <p className="text-xs leading-relaxed">{String(r.point ?? "")}</p>
                      {r.cause ? (
                        <p className="muted text-[11px] mt-1 leading-relaxed">原因: {String(r.cause)}</p>
                      ) : null}
                    </>
                  )}
                />
              </div>

              <ReportList
                title="顧客導線上の問題"
                rows={report.funnel_issues as Row[]}
                render={(r) => (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge tone="warn">{String(r.stage ?? "")}</Badge>
                    </div>
                    <p className="text-xs mt-1.5 leading-relaxed">{String(r.issue ?? "")}</p>
                    <p className="text-[11px] text-emerald-600 mt-1 leading-relaxed">
                      改善: {String(r.fix ?? "")}
                    </p>
                  </>
                )}
              />

              <ReportList
                title="競合・市場の変化"
                rows={report.market_changes as Row[]}
                render={(r) => (
                  <>
                    <p className="text-xs leading-relaxed">{String(r.change ?? "")}</p>
                    {r.impact ? (
                      <p className="muted text-[11px] mt-1 leading-relaxed">影響: {String(r.impact)}</p>
                    ) : null}
                  </>
                )}
              />
            </div>

            <div className="space-y-5">
              <Card>
                <CardHeader title="来月の戦略" />
                {report.next_strategy ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="muted">重点</p>
                      <p className="mt-0.5 leading-relaxed">
                        {String((report.next_strategy as Row).focus ?? "—")}
                      </p>
                    </div>
                    {((report.next_strategy as Row).themes as string[])?.length ? (
                      <div>
                        <p className="muted mb-1">テーマ</p>
                        <div className="flex flex-wrap gap-1.5">
                          {((report.next_strategy as Row).themes as string[]).map((t) => (
                            <Badge key={t} tone="brand">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="muted text-xs">—</p>
                )}
              </Card>

              <ReportList
                title="推奨キャンペーン"
                rows={report.recommended_campaigns as Row[]}
                render={(r) => (
                  <>
                    <p className="text-xs font-medium">{String(r.name ?? "")}</p>
                    <p className="muted text-[11px] mt-1 leading-relaxed">{String(r.hypothesis ?? "")}</p>
                  </>
                )}
              />

              <ReportList
                title="必要な広報材料"
                rows={report.needed_materials as Row[]}
                render={(r) => (
                  <>
                    <p className="text-xs font-medium">{String(r.material ?? "")}</p>
                    <p className="muted text-[11px] mt-0.5 leading-relaxed">{String(r.why ?? "")}</p>
                  </>
                )}
              />

              <ReportList
                title="AIが学習した内容"
                rows={report.learnings as Row[]}
                render={(r) => (
                  <p className="text-xs leading-relaxed">{String(r.learned ?? JSON.stringify(r))}</p>
                )}
              />

              {report.expected_impact && (
                <Card>
                  <CardHeader title="改善した場合の期待効果" />
                  <p className="text-xs leading-relaxed">{report.expected_impact}</p>
                </Card>
              )}

              <Card>
                <CardHeader title="出席したAI広報部" />
                <ul className="space-y-2">
                  {AGENTS.map((a) => (
                    <li key={a.key} className="flex items-center gap-2.5">
                      <span style={{ color: a.color }} className="shrink-0">
                        <AgentIcon agent={a.key} size={20} still />
                      </span>
                      <span className="text-xs">{a.name}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ReportList({
  title,
  rows,
  render,
}: {
  title: string;
  rows: Row[] | null;
  render: (row: Row) => React.ReactNode;
}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;

  return (
    <Card>
      <CardHeader title={title} />
      <ul className="space-y-2.5">
        {list.map((r, i) => (
          <li key={i} className="p-3 rounded-xl bg-[var(--surface-2)]">
            {render(r)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
