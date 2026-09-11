import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState, StatTile } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/shared";
import { formatDate } from "@/lib/format-date";
import { FactTable, AddFact } from "./Actions";
import { ShieldCheckIcon } from "@/components/icons/AgentIcons";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  pricing: "料金",
  product: "商品・機能",
  feature: "機能",
  clients: "導入実績",
  area: "対応地域",
  leader: "代表者情報",
  metric: "数値",
  award: "受賞歴",
  other: "その他",
};

export default async function FactsPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();

  const { data: facts } = await sb
    .from("official_facts")
    .select("*")
    .eq("subject_id", ctx.subjectId)
    .order("category")
    .order("key");

  const list = facts ?? [];
  const now = Date.now();
  const expired = list.filter((f) => f.expires_at && new Date(f.expires_at).getTime() < now);
  const stale = list.filter(
    (f) =>
      !f.verified_at ||
      new Date(f.verified_at).getTime() < now - 180 * 864e5,
  );

  return (
    <>
      <PageHeader
        title="公式事実データベース"
        description="AIが断定してよい数値・事実の台帳です。ここに無い数字が本文に含まれると警告し、確認が取れるまで投稿を停止します。"
        agent="analyst"
        action={<AddFact subjectId={ctx.subjectId} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile label="登録件数" value={list.length} unit="件" accent="var(--color-analyst)" />
        <StatTile
          label="公開可能"
          value={list.filter((f) => f.visibility === "public").length}
          unit="件"
          accent="var(--color-writer)"
        />
        <StatTile
          label="期限切れ"
          value={expired.length}
          unit="件"
          accent={expired.length ? "var(--color-bad)" : "var(--color-ink-400)"}
        />
        <StatTile
          label="要再確認"
          value={stale.length}
          unit="件"
          accent={stale.length ? "var(--color-warn)" : "var(--color-ink-400)"}
        />
      </div>

      {expired.length > 0 && (
        <Card className="mb-5 border-red-300">
          <CardHeader
            title="期限切れの事実があります"
            subtitle="これらを含むコンテンツは投稿前に警告されます。最新の内容へ更新してください。"
          />
          <ul className="space-y-1.5">
            {expired.map((f) => (
              <li key={f.id} className="text-xs flex items-center gap-2">
                <Badge tone="bad">{CATEGORY_LABEL[f.category] ?? f.category}</Badge>
                <span className="font-medium">{f.key}</span>
                <span className="muted">= {f.value}</span>
                <span className="ml-auto muted tabular-nums">
                  期限 {formatDate(f.expires_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!list.length ? (
        <Card>
          <EmptyState
            icon={<ShieldCheckIcon size={30} />}
            title="公式事実が登録されていません"
            body="料金・導入実績・受賞歴などを登録すると、AIがその数値だけを断定して書けるようになります。"
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="登録済みの事実"
            subtitle="社内限定に設定した情報は、外部発信に一切含まれません。"
          />
          <FactTable
            subjectId={ctx.subjectId}
            facts={list.map((f) => ({
              id: f.id,
              category: f.category,
              categoryLabel: CATEGORY_LABEL[f.category] ?? f.category,
              key: f.key,
              value: f.value,
              status: f.status,
              visibility: f.visibility,
              source: f.source,
              sourceUrl: f.source_url,
              verifiedAt: formatDate(f.verified_at),
              expiresAt: f.expires_at ? formatDate(f.expires_at) : null,
              isExpired: Boolean(f.expires_at && new Date(f.expires_at).getTime() < now),
            }))}
          />
        </Card>
      )}
    </>
  );
}
