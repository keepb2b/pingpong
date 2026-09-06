import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState, riskTone } from "@/components/ui";
import { PageHeader, formatDateTime } from "@/components/dashboard/shared";
import { MentionRow, AddMention } from "./Actions";
import { RISK_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  google_review: "Google口コミ",
  line: "LINE",
  email: "メール",
  web: "Web",
};

export default async function MentionsPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const subjectId = ctx.subjectId;
  const sb = await supabaseServer();

  const [{ data: mentions }, { data: replies }] = await Promise.all([
    sb
      .from("mentions")
      .select("*")
      .eq("subject_id", subjectId)
      .order("occurred_at", { ascending: false })
      .limit(60),
    sb
      .from("mention_replies")
      .select("id, mention_id, draft, approved, sent_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false }),
  ]);

  type Reply = { id: string; mention_id: string; draft: string; approved: boolean; sent_at: string | null };
  const replyMap = new Map<string, Reply>();
  for (const r of replies ?? []) if (!replyMap.has(r.mention_id)) replyMap.set(r.mention_id, r);

  const list = mentions ?? [];
  const needsHuman = list.filter((m) => m.needs_human && m.status !== "replied");
  const open = list.filter((m) => !m.needs_human && m.status !== "replied");
  const done = list.filter((m) => m.status === "replied");

  return (
    <>
      <PageHeader
        title="コメント・口コミ・評判管理"
        description="投稿後の反応もAI広報部が管理します。感情・緊急度・炎上リスクを判定し、返信案を作成します。AIだけで返信すべきでない内容は担当者へ引き継ぎます。"
        agent="marketer"
        action={<AddMention subjectId={subjectId} />}
      />

      <div className="space-y-5">
        {needsHuman.length > 0 && (
          <Card className="border-red-300">
            <CardHeader
              title="担当者の判断が必要です"
              subtitle="法的責任・重大なクレーム・炎上の可能性があるため、AIだけで返信しません。"
              action={<Badge tone="bad">{needsHuman.length}件</Badge>}
            />
            <ul className="space-y-3">
              {needsHuman.map((m) => (
                <MentionRow
                  key={m.id}
                  mention={{
                    id: m.id,
                    source: SOURCE_LABEL[m.source] ?? m.source,
                    author: m.author,
                    body: m.body,
                    rating: m.rating,
                    sentiment: m.sentiment,
                    urgency: m.urgency,
                    flareRisk: m.flare_risk,
                    riskLabel: RISK_LABEL[m.flare_risk] ?? m.flare_risk,
                    riskTone: riskTone(m.flare_risk),
                    occurredAt: formatDateTime(m.occurred_at),
                    url: m.url,
                    needsHuman: true,
                  }}
                  reply={replyMap.get(m.id) ?? null}
                  subjectId={subjectId}
                />
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title="対応待ち" action={<Badge tone="warn">{open.length}件</Badge>} />
          {!open.length ? (
            <EmptyState
              title="対応待ちのコメントはありません"
              body="SNSコメント・Google口コミ・問い合わせを登録すると、AIが返信案を作成します。"
            />
          ) : (
            <ul className="space-y-3">
              {open.map((m) => (
                <MentionRow
                  key={m.id}
                  mention={{
                    id: m.id,
                    source: SOURCE_LABEL[m.source] ?? m.source,
                    author: m.author,
                    body: m.body,
                    rating: m.rating,
                    sentiment: m.sentiment,
                    urgency: m.urgency,
                    flareRisk: m.flare_risk,
                    riskLabel: RISK_LABEL[m.flare_risk] ?? m.flare_risk,
                    riskTone: riskTone(m.flare_risk),
                    occurredAt: formatDateTime(m.occurred_at),
                    url: m.url,
                    needsHuman: false,
                  }}
                  reply={replyMap.get(m.id) ?? null}
                  subjectId={subjectId}
                />
              ))}
            </ul>
          )}
        </Card>

        {done.length > 0 && (
          <Card>
            <CardHeader title="対応済み" action={<Badge tone="good">{done.length}件</Badge>} />
            <ul className="divide-y divide-[var(--border)]">
              {done.map((m) => (
                <li key={m.id} className="py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge>{SOURCE_LABEL[m.source] ?? m.source}</Badge>
                    <span className="muted text-[11px] tabular-nums">
                      {formatDateTime(m.occurred_at)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed line-clamp-2">{m.body}</p>
                  {replyMap.get(m.id)?.draft && (
                    <p className="muted text-[11px] mt-1.5 leading-relaxed line-clamp-2">
                      返信: {replyMap.get(m.id)!.draft}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
