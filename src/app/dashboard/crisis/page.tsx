import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState, riskTone } from "@/components/ui";
import { PageHeader, AgentButton, ActionButton, formatDateTime } from "@/components/dashboard/shared";
import { OpenCrisis } from "./Actions";
import { AlertIcon } from "@/components/icons/AgentIcons";
import { RISK_LABEL, STATUS_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CrisisPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();

  const [{ data: incidents }, { data: actions }] = await Promise.all([
    sb
      .from("crisis_incidents")
      .select("*")
      .eq("subject_id", ctx.subjectId)
      .order("opened_at", { ascending: false })
      .limit(20),
    sb
      .from("crisis_actions")
      .select("id, incident_id, action, detail, created_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false }),
  ]);

  const active = (incidents ?? []).filter((i) => ["open", "containing"].includes(i.status));
  const past = (incidents ?? []).filter((i) => !["open", "containing"].includes(i.status));

  return (
    <>
      <PageHeader
        title="危機広報"
        description="事故・障害・炎上・情報漏洩・重大なクレームが発生した場合、危機広報モードへ切り替えます。緊急時に通常の宣伝投稿が公開され続けることを防ぎます。"
        action={<OpenCrisis subjectId={ctx.subjectId} />}
      />

      {active.length === 0 && past.length === 0 ? (
        <Card>
          <EmptyState
            icon={<AlertIcon size={30} />}
            title="発生中の事案はありません"
            body="万一の際は「危機広報モードを開始」を押すと、予約投稿を一括停止し、事実整理・公式声明案・想定問答を用意します。"
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {active.map((inc) => {
            const facts = (inc.facts ?? []) as Array<{ fact: string; confirmed: boolean }>;
            const qa = (inc.qa ?? []) as Array<{ q: string; a: string }>;
            const notices = (inc.notices ?? {}) as Record<string, string>;
            const log = (actions ?? []).filter((a) => a.incident_id === inc.id);

            return (
              <Card key={inc.id} className="border-red-400">
                <CardHeader
                  title={inc.title}
                  subtitle={`${inc.category} · 発生 ${formatDateTime(inc.opened_at)}`}
                  icon={
                    <span className="text-red-600">
                      <AlertIcon size={26} />
                    </span>
                  }
                  action={
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge tone={riskTone(inc.severity)}>{RISK_LABEL[inc.severity]}</Badge>
                      <Badge tone="bad">{STATUS_LABEL[inc.status] ?? inc.status}</Badge>
                      {inc.posts_paused && <Badge tone="warn">予約投稿 停止中</Badge>}
                    </div>
                  }
                />

                <div className="flex flex-wrap gap-2 mb-5">
                  <AgentButton
                    label="危機広報の初動一式を作成"
                    body={{ action: "crisis_response", subjectId: ctx.subjectId, incidentId: inc.id }}
                    successMessage="声明案・想定問答を作成しました"
                  />
                  <ActionButton
                    label="通常運用への復帰を承認"
                    path="/api/reputation"
                    body={{ action: "resume_posting", id: inc.id }}
                    variant="success"
                    size="md"
                    confirm="投稿を再開します。事実確認と対応が完了していることをご確認ください。"
                  />
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    {facts.length > 0 && (
                      <section>
                        <h3 className="text-xs font-semibold mb-2">事実関係の整理</h3>
                        <ul className="space-y-1.5">
                          {facts.map((f, i) => (
                            <li key={i} className="text-xs flex items-start gap-2">
                              <Badge tone={f.confirmed ? "good" : "warn"}>
                                {f.confirmed ? "確認済" : "確認中"}
                              </Badge>
                              <span className="leading-relaxed">{f.fact}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {inc.statement && (
                      <section>
                        <h3 className="text-xs font-semibold mb-1.5">公式声明案</h3>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap p-3 rounded-[4px] bg-[var(--surface-2)]">
                          {inc.statement}
                        </p>
                      </section>
                    )}

                    {inc.apology && (
                      <section>
                        <h3 className="text-xs font-semibold mb-1.5">お詫び文</h3>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap p-3 rounded-[4px] bg-[var(--surface-2)]">
                          {inc.apology}
                        </p>
                      </section>
                    )}

                    {inc.sns_policy && (
                      <section>
                        <h3 className="text-xs font-semibold mb-1.5">SNS返信方針</h3>
                        <p className="text-xs leading-relaxed">{inc.sns_policy}</p>
                      </section>
                    )}
                  </div>

                  <div className="space-y-4">
                    {qa.length > 0 && (
                      <section>
                        <h3 className="text-xs font-semibold mb-2">想定問答</h3>
                        <ul className="space-y-2.5">
                          {qa.map((item, i) => (
                            <li key={i} className="text-xs">
                              <p className="font-medium">Q. {item.q}</p>
                              <p className="muted mt-1 leading-relaxed">A. {item.a}</p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {Object.keys(notices).length > 0 && (
                      <section>
                        <h3 className="text-xs font-semibold mb-2">関係者向け案内</h3>
                        <div className="space-y-2">
                          {[
                            { key: "customers", label: "顧客向け" },
                            { key: "partners", label: "取引先向け" },
                            { key: "internal", label: "社内向け" },
                          ].map(
                            (n) =>
                              notices[n.key] && (
                                <div key={n.key}>
                                  <p className="text-[11px] muted">{n.label}</p>
                                  <p className="text-xs leading-relaxed mt-0.5">{notices[n.key]}</p>
                                </div>
                              ),
                          )}
                        </div>
                      </section>
                    )}

                    {log.length > 0 && (
                      <section>
                        <h3 className="text-xs font-semibold mb-2">対応履歴</h3>
                        <ul className="space-y-1.5">
                          {log.map((a) => (
                            <li key={a.id} className="text-[11px] flex items-start gap-2">
                              <span className="muted tabular-nums shrink-0">
                                {formatDateTime(a.created_at)}
                              </span>
                              <span className="leading-relaxed">
                                {a.action}
                                {a.detail && <span className="muted"> — {a.detail}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {past.length > 0 && (
            <Card>
              <CardHeader title="過去の事案" />
              <ul className="divide-y divide-[var(--border)]">
                {past.map((i) => (
                  <li key={i.id} className="py-3 flex items-center gap-3 text-xs">
                    <Badge tone="good">{STATUS_LABEL[i.status] ?? i.status}</Badge>
                    <span className="truncate flex-1">{i.title}</span>
                    <span className="muted tabular-nums shrink-0">{formatDateTime(i.opened_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
