import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/shared";
import { formatDateTime } from "@/lib/format-date";
import { LearningRow } from "./Actions";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; tone: "neutral" | "good" | "warn" | "info" | "bad" }> = {
  pending: { label: "未確認", tone: "warn" },
  confirmed: { label: "正しい", tone: "good" },
  corrected: { label: "修正済み", tone: "info" },
  once_only: { label: "今回だけ", tone: "neutral" },
  long_term: { label: "長期記憶", tone: "good" },
  forgotten: { label: "忘却済み", tone: "neutral" },
};

const CATEGORY_LABEL: Record<string, string> = {
  preference: "文章・表現の好み",
  rule: "運用ルール",
  brand: "ブランド",
  fact: "事実",
};

export default async function LearningsPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();

  const { data: learnings } = await sb
    .from("learnings")
    .select("*")
    .eq("subject_id", ctx.subjectId)
    .order("created_at", { ascending: false })
    .limit(80);

  const list = learnings ?? [];
  const pending = list.filter((l) => l.status === "pending");
  const active = list.filter((l) => ["confirmed", "corrected", "long_term", "once_only"].includes(l.status));
  const forgotten = list.filter((l) => l.status === "forgotten");

  return (
    <>
      <PageHeader
        title="AIが学習した内容"
        description="AIは毎日の対話・修正・承認・投稿結果から企業への理解を深めます。何を記憶しているかを確認・修正できるため、誤った学習が蓄積されることを防ぎます。"
        agent="secretary"
      />

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="確認をお願いします"
            subtitle="AIが学習しようとしている内容です。正しいかどうかを判断してください。"
            action={<Badge tone="warn">{pending.length}件</Badge>}
          />

          {!pending.length ? (
            <EmptyState
              title="確認待ちの学習内容はありません"
              body="LINEでのやり取りや承認の判断から、AIが気づいたことがここに並びます。"
            />
          ) : (
            <ul className="space-y-3 stagger">
              {pending.map((l) => (
                <LearningRow
                  key={l.id}
                  id={l.id}
                  statement={l.statement}
                  evidence={l.evidence}
                  category={CATEGORY_LABEL[l.category] ?? l.category}
                  createdAt={formatDateTime(l.created_at)}
                />
              ))}
            </ul>
          )}
        </Card>

        {active.length > 0 && (
          <Card>
            <CardHeader
              title="記憶している内容"
              subtitle="これらはコンテンツ制作時にAIへ渡されます。"
            />
            <ul className="space-y-2.5">
              {active.map((l) => {
                const meta = STATUS_META[l.status] ?? STATUS_META.pending;
                return (
                  <li
                    key={l.id}
                    className="p-3.5 rounded-[4px] border border-[var(--border)] flex items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <Badge>{CATEGORY_LABEL[l.category] ?? l.category}</Badge>
                        {l.expires_at && (
                          <span className="text-[11px] muted">
                            期限 {formatDateTime(l.expires_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed">{l.corrected_to ?? l.statement}</p>
                      {l.corrected_to && (
                        <p className="muted text-[11px] mt-1 line-through">{l.statement}</p>
                      )}
                    </div>
                    <LearningRow
                      id={l.id}
                      statement={l.statement}
                      evidence={l.evidence}
                      category={CATEGORY_LABEL[l.category] ?? l.category}
                      createdAt={formatDateTime(l.created_at)}
                      compact
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {forgotten.length > 0 && (
          <Card>
            <CardHeader title="忘却した内容" subtitle="AIはこれらを参照しません。" />
            <ul className="space-y-1.5">
              {forgotten.map((l) => (
                <li key={l.id} className="text-xs muted line-through">
                  {l.statement}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
