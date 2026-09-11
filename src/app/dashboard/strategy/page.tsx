import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { PageHeader, AgentButton, ActionButton } from "@/components/dashboard/shared";
import { formatDate } from "@/lib/format-date";
import { CHANNEL_LABEL, GOAL_LABEL, type ChannelKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Theme = {
  theme: string;
  angle: string;
  audience: string;
  channels: string[];
  content_types: string[];
  priority: number;
};

export default async function StrategyPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();
  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const [{ data: strategies }, { data: objectives }, { data: kpis }, { data: campaigns }] =
    await Promise.all([
      sb
        .from("strategies")
        .select("*")
        .eq("subject_id", ctx.subjectId)
        .order("created_at", { ascending: false })
        .limit(6),
      sb
        .from("pr_objectives")
        .select("goal, priority, description")
        .eq("subject_id", ctx.subjectId)
        .eq("active", true)
        .order("priority"),
      sb.from("kpis").select("*").eq("subject_id", ctx.subjectId),
      sb
        .from("campaigns")
        .select("id, name, hypothesis, goal, starts_on, ends_on, status")
        .eq("subject_id", ctx.subjectId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const latest = strategies?.[0];

  return (
    <>
      <PageHeader
        title="広報戦略"
        description="投稿数ではなく、達成したい目的から逆算して設計します。KPIと顧客導線につながらない施策は提案されません。"
        agent="strategist"
        action={
          <>
            <AgentButton
              label={`${period}の戦略を作る`}
              body={{ action: "build_strategy", subjectId: ctx.subjectId, period }}
              successMessage="AIストラテジストが戦略を設計しました"
            />
            <AgentButton
              label="最適な投稿頻度を提案"
              body={{ action: "recommend_cadence", subjectId: ctx.subjectId }}
              variant="secondary"
            />
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {!latest ? (
            <Card>
              <EmptyState
                title="まだ戦略がありません"
                body="「今月の戦略を作る」を押すと、広報目的・KPI・市場・競合・保有素材から戦略を設計します。"
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title={latest.title}
                  subtitle={`${latest.period} · ${latest.status === "approved" ? "承認済み" : "下書き"}`}
                  action={
                    latest.status !== "approved" && (
                      <ActionButton
                        label="この戦略を承認"
                        path="/api/workflow"
                        body={{ action: "approve_strategy", id: latest.id }}
                        variant="primary"
                      />
                    )
                  }
                />
                <p className="text-sm leading-relaxed">{latest.summary}</p>

                {(latest.goals as Array<{ goal: string; why: string; kpi: string; target: number }>)
                  ?.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-semibold mb-2">この期間の目標</p>
                    <ul className="space-y-2">
                      {(
                        latest.goals as Array<{ goal: string; why: string; kpi: string; target: number }>
                      ).map((g, i) => (
                        <li key={i} className="p-3 rounded-[4px] bg-[var(--surface-2)] text-xs">
                          <div className="flex items-center gap-2">
                            <Badge tone="brand">
                              {GOAL_LABEL[g.goal as keyof typeof GOAL_LABEL] ?? g.goal}
                            </Badge>
                            <span className="tabular-nums muted">
                              {g.kpi} 目標 {g.target}
                            </span>
                          </div>
                          <p className="mt-1.5 leading-relaxed">{g.why}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>

              {(latest.themes as Theme[])?.length > 0 && (
                <Card>
                  <CardHeader
                    title="発信テーマ"
                    subtitle="競合と同じ切り口を避け、自社にしか出せない情報資産を使います。"
                  />
                  <ul className="space-y-3">
                    {(latest.themes as Theme[])
                      .slice()
                      .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9))
                      .map((t, i) => (
                        <li key={i} className="p-4 rounded-[4px] border border-[var(--border)]">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium">{t.theme}</p>
                            <Badge>優先度 {t.priority}</Badge>
                          </div>
                          <p className="muted text-xs mt-1.5 leading-relaxed">{t.angle}</p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] muted">対象: {t.audience}</span>
                            {(t.channels ?? []).map((c) => (
                              <Badge key={c} tone="info">
                                {CHANNEL_LABEL[c as ChannelKey] ?? c}
                              </Badge>
                            ))}
                          </div>
                        </li>
                      ))}
                  </ul>
                </Card>
              )}

              {(latest.calendar as Array<{ week: number; focus: string; deliverables: string[] }>)
                ?.length > 0 && (
                <Card>
                  <CardHeader title="広報カレンダー" />
                  <ol className="space-y-2">
                    {(
                      latest.calendar as Array<{ week: number; focus: string; deliverables: string[] }>
                    ).map((w) => (
                      <li key={w.week} className="flex gap-3 p-3 rounded-[4px] bg-[var(--surface-2)]">
                        <span className="text-xs font-bold tabular-nums shrink-0 w-12 text-brand-600">
                          第{w.week}週
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium">{w.focus}</p>
                          <p className="muted text-[11px] mt-0.5">{(w.deliverables ?? []).join(" / ")}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="広報目的" subtitle="優先順に設定されています" />
            {!objectives?.length ? (
              <p className="muted text-xs">未設定です。設定画面から登録してください。</p>
            ) : (
              <ol className="space-y-2">
                {objectives.map((o) => (
                  <li key={o.goal} className="flex items-center gap-2.5 text-xs">
                    <span className="h-5 w-5 rounded-full bg-brand-600 text-white grid place-items-center text-[10px] font-bold shrink-0">
                      {o.priority}
                    </span>
                    {GOAL_LABEL[o.goal as keyof typeof GOAL_LABEL] ?? o.goal}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader title="KPI" />
            {!kpis?.length ? (
              <p className="muted text-xs">KPIが未設定です。</p>
            ) : (
              <ul className="space-y-3">
                {kpis.map((k) => {
                  const pct = k.target_value
                    ? Math.min(100, Math.round((k.current_value / k.target_value) * 100))
                    : 0;
                  return (
                    <li key={k.id}>
                      <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
                        <span className="font-medium truncate">{k.name}</span>
                        <span className="muted tabular-nums shrink-0">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-[width] duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="キャンペーン" />
            {!campaigns?.length ? (
              <p className="muted text-xs">実施中のキャンペーンはありません。</p>
            ) : (
              <ul className="space-y-2.5">
                {campaigns.map((c) => (
                  <li key={c.id} className="text-xs">
                    <p className="font-medium">{c.name}</p>
                    {c.hypothesis && <p className="muted mt-0.5 leading-relaxed">{c.hypothesis}</p>}
                    <p className="muted mt-1 tabular-nums">
                      {formatDate(c.starts_on)} 〜 {formatDate(c.ends_on)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {strategies && strategies.length > 1 && (
            <Card>
              <CardHeader title="過去の戦略" />
              <ul className="space-y-1.5">
                {strategies.slice(1).map((s) => (
                  <li key={s.id} className="text-xs flex items-center gap-2">
                    <span className="muted tabular-nums shrink-0">{s.period}</span>
                    <span className="truncate">{s.title}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
