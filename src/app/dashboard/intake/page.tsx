import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { PageHeader, formatDateTime } from "@/components/dashboard/shared";
import { IntakeActions, AddIntake } from "./Actions";
import { AgentIcon, LineIcon } from "@/components/icons/AgentIcons";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  event: "出来事",
  achievement: "成果・評価",
  new_service: "新サービス",
  customer_voice: "顧客の声",
  photo: "写真",
  document: "資料",
  number: "数値",
  other: "その他",
};

export default async function IntakePage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const subjectId = ctx.subjectId;
  const sb = await supabaseServer();

  const [{ data: items }, { data: conversations }, { data: assets }] = await Promise.all([
    sb
      .from("intake_items")
      .select("*")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(60),
    sb
      .from("conversations")
      .select("id, topic, status, pending_question, last_message_at, question_index")
      .eq("subject_id", subjectId)
      .order("last_message_at", { ascending: false })
      .limit(6),
    sb
      .from("media_assets")
      .select("id, url, kind, caption, created_at")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const unused = (items ?? []).filter((i) => i.status === "new");
  const used = (items ?? []).filter((i) => i.status !== "new");

  return (
    <>
      <PageHeader
        title="広報材料・AI取材"
        description="LINEで送られた出来事を、AI秘書が1問ずつ聞き取って広報材料に整えています。ここから記事・投稿・事例へ展開されます。"
        agent="secretary"
        action={<AddIntake subjectId={subjectId} />}
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader
              title="未使用の広報材料"
              subtitle="まだ発信に使っていない材料です。ニュース性の高いものから提案に使われます。"
              action={<Badge tone="brand">{unused.length}件</Badge>}
            />

            {!unused.length ? (
              <EmptyState
                icon={<LineIcon size={30} />}
                title="未使用の材料はありません"
                body="LINEに「今日こんなことがありました」と送るだけで、AI秘書が必要な情報を聞き取ります。"
              />
            ) : (
              <ul className="space-y-3 stagger">
                {unused.map((i) => (
                  <li key={i.id} className="p-4 rounded-xl border border-[var(--border)]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-snug">{i.title}</p>
                      <div className="flex gap-1.5 shrink-0">
                        <Badge>{KIND_LABEL[i.kind] ?? i.kind}</Badge>
                        {!i.disclosable && <Badge tone="bad">非公開</Badge>}
                      </div>
                    </div>

                    {i.raw_text && (
                      <p className="muted text-xs mt-2 leading-relaxed whitespace-pre-wrap line-clamp-4">
                        {i.raw_text}
                      </p>
                    )}

                    {(i.structured as { facts?: Array<{ key: string; value: string }> })?.facts
                      ?.length ? (
                      <dl className="mt-2.5 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        {(
                          i.structured as { facts: Array<{ key: string; value: string }> }
                        ).facts.map((f, idx) => (
                          <div key={idx} className="flex gap-1.5">
                            <dt className="muted shrink-0">{f.key}:</dt>
                            <dd className="truncate">{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}

                    {(i.structured as { missing?: string[] })?.missing?.length ? (
                      <p className="text-[11px] text-amber-600 mt-2">
                        未確認: {(i.structured as { missing: string[] }).missing.join("、")}
                      </p>
                    ) : null}

                    <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
                      <span className="text-[11px] muted tabular-nums">
                        ニュース性 {i.newsworthiness} · {formatDateTime(i.created_at)}
                      </span>
                      <div className="ml-auto">
                        <IntakeActions id={i.id} subjectId={subjectId} title={i.title} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {used.length > 0 && (
            <Card>
              <CardHeader title="使用済みの材料" />
              <ul className="divide-y divide-[var(--border)]">
                {used.map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center gap-3 text-xs">
                    <span className="truncate flex-1">{i.title}</span>
                    <Badge>{KIND_LABEL[i.kind] ?? i.kind}</Badge>
                    <span className="muted tabular-nums shrink-0">{i.used_count}回使用</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="AI取材の進行状況"
              icon={
                <span className="text-[color:var(--color-secretary)]">
                  <AgentIcon agent="secretary" size={28} />
                </span>
              }
            />
            {!conversations?.length ? (
              <p className="muted text-xs">まだ会話がありません。</p>
            ) : (
              <ul className="space-y-3">
                {conversations.map((c) => (
                  <li key={c.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Badge tone={c.status === "open" ? "warn" : "good"}>
                        {c.status === "open" ? "聞き取り中" : "完了"}
                      </Badge>
                      <span className="muted tabular-nums">{formatDateTime(c.last_message_at)}</span>
                    </div>
                    {c.pending_question && (
                      <p className="mt-1.5 leading-relaxed p-2 rounded-lg bg-[var(--surface-3)]">
                        {c.pending_question}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="受け取った素材" subtitle="LINEから送られた写真・動画・資料" />
            {!assets?.length ? (
              <p className="muted text-xs">まだ素材はありません。</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {assets.map((a) =>
                  a.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={a.id}
                      src={a.url ?? ""}
                      alt={a.caption ?? "受け取った写真"}
                      className="aspect-square object-cover rounded-lg border border-[var(--border)]"
                    />
                  ) : (
                    <div
                      key={a.id}
                      className="aspect-square rounded-lg border border-[var(--border)] grid place-items-center text-[10px] muted"
                    >
                      {a.kind}
                    </div>
                  ),
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
