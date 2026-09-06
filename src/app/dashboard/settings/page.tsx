import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge } from "@/components/ui";
import { PageHeader, AgentButton } from "@/components/dashboard/shared";
import {
  LineLinkPanel,
  DialoguePanel,
  ChannelPanel,
  ObjectivesPanel,
  KpiPanel,
  SubjectsPanel,
  MembersPanel,
} from "./Panels";
import { ROLE_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();

  const [
    { data: channels },
    { data: dialogue },
    { data: objectives },
    { data: kpis },
    { data: subjects },
    { data: members },
    { data: lineAccounts },
    { data: rules },
  ] = await Promise.all([
    sb.from("channels").select("*").eq("subject_id", ctx.subjectId).order("type"),
    sb.from("dialogue_settings").select("*").eq("subject_id", ctx.subjectId).maybeSingle(),
    sb
      .from("pr_objectives")
      .select("goal, priority")
      .eq("subject_id", ctx.subjectId)
      .eq("active", true)
      .order("priority"),
    sb.from("kpis").select("*").eq("subject_id", ctx.subjectId),
    sb.from("subjects").select("*").eq("org_id", ctx.orgId).order("is_primary", { ascending: false }),
    sb
      .from("memberships")
      .select("id, role, user_id, profiles(display_name, email)")
      .eq("org_id", ctx.orgId),
    sb
      .from("line_accounts")
      .select("id, display_name, picture_url, linked_at")
      .eq("org_id", ctx.orgId),
    sb.from("approval_rules").select("*").eq("subject_id", ctx.subjectId),
  ]);

  return (
    <>
      <PageHeader
        title="設定・連携"
        description="対話頻度、投稿頻度、媒体連携、広報対象、権限を設定します。すべていつでも変更できます。"
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <div id="line" className="scroll-mt-20">
            <Card>
              <CardHeader
                title="LINE連携"
                subtitle="AI広報部の窓口です。連携コードをLINEのトークへ送信すると、ヒアリングが始まります。"
              />
              <LineLinkPanel
                accounts={(lineAccounts ?? []).map((a) => ({
                  id: a.id,
                  name: a.display_name,
                  picture: a.picture_url,
                }))}
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              title="AI秘書のヒアリング頻度"
              subtitle="経営者・担当者の負担に合わせて調整できます。「一時停止」も選べます。"
            />
            <DialoguePanel
              subjectId={ctx.subjectId}
              initial={{
                frequency: dialogue?.frequency ?? "daily",
                custom_days: dialogue?.custom_days ?? [],
                send_hour: dialogue?.send_hour ?? 9,
                max_questions: dialogue?.max_questions_per_session ?? 5,
              }}
            />
          </Card>

          <Card>
            <CardHeader
              title="広報目的"
              subtitle="優先順に選びます。目的に応じてKPI・媒体・CTA・投稿頻度が変わります。"
            />
            <ObjectivesPanel
              subjectId={ctx.subjectId}
              selected={(objectives ?? []).map((o) => o.goal)}
            />
          </Card>

          <Card>
            <CardHeader title="KPI" subtitle="広報目的から逆算した目標値を設定します。" />
            <KpiPanel
              subjectId={ctx.subjectId}
              kpis={(kpis ?? []).map((k) => ({
                id: k.id,
                name: k.name,
                metric: k.metric,
                target_value: k.target_value,
                current_value: k.current_value,
                unit: k.unit,
              }))}
            />
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="媒体と投稿頻度"
              subtitle="媒体ごとに頻度と自動投稿を設定できます。自動投稿はリスク上限以下の場合のみ実行されます。"
              action={
                <AgentButton
                  label="AIに頻度を提案させる"
                  body={{ action: "recommend_cadence", subjectId: ctx.subjectId }}
                  variant="secondary"
                  size="sm"
                />
              }
            />
            <ChannelPanel
              subjectId={ctx.subjectId}
              channels={(channels ?? []).map((c) => ({
                type: c.type,
                handle: c.handle,
                connected: c.connected,
                frequency_mode: c.frequency_mode,
                frequency_count: c.frequency_count,
                auto_publish: c.auto_publish,
                auto_publish_max_risk: c.auto_publish_max_risk,
                credentials: (c.credentials ?? {}) as Record<string, string>,
              }))}
            />
          </Card>

          <div id="subjects" className="scroll-mt-20">
            <Card>
              <CardHeader
                title="広報対象"
                subtitle="企業・サービス・商品・ブランド・店舗・個人を追加できます。2件目以降は月額9,800円／件です。"
              />
              <SubjectsPanel
                subjects={(subjects ?? []).map((s) => ({
                  id: s.id,
                  name: s.name,
                  type: s.type,
                  is_primary: s.is_primary,
                  active: s.active,
                }))}
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              title="メンバーと権限"
              subtitle="管理者・編集者・法務確認者・ブランド管理者・最終承認者を設定できます。"
            />
            <MembersPanel
              currentUserId={ctx.userId}
              role={ctx.role}
              members={(members ?? []).map((m) => {
                const profile = m.profiles as unknown as {
                  display_name: string | null;
                  email: string | null;
                } | null;
                return {
                  id: m.id,
                  userId: m.user_id,
                  role: m.role,
                  name: profile?.display_name ?? profile?.email ?? "—",
                  email: profile?.email ?? "",
                };
              })}
            />
          </Card>

          <Card>
            <CardHeader
              title="承認ルール"
              subtitle="どのリスク水準から、誰の承認を必須にするかを定めます。"
            />
            {!rules?.length ? (
              <p className="muted text-xs">既定ルール: すべてのコンテンツに最終承認者の承認が必要です。</p>
            ) : (
              <ul className="space-y-2">
                {rules.map((r) => (
                  <li key={r.id} className="text-xs flex flex-wrap items-center gap-2">
                    <Badge tone="brand">
                      {r.content_type ?? "すべての種別"} / {r.channel ?? "すべての媒体"}
                    </Badge>
                    <span className="muted">リスク {r.min_risk} 以上</span>
                    <span>
                      →{" "}
                      {(r.required_roles ?? [])
                        .map((x: string) => ROLE_LABEL[x] ?? x)
                        .join("、")}
                      の承認
                    </span>
                    {r.auto_approve && <Badge tone="warn">自動承認</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
