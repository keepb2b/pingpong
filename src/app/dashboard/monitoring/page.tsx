import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { PageHeader, formatDateTime } from "@/components/dashboard/shared";
import { AddCompetitor } from "./Actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  competitor_update: "競合サイト更新",
  seasonal: "季節・イベント",
  cycle: "運用サイクル",
  news: "ニュース",
  trend: "検索トレンド",
  review: "口コミ",
};

export default async function MonitoringPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();

  const [{ data: signals }, { data: competitors }] = await Promise.all([
    sb
      .from("market_signals")
      .select("*")
      .eq("subject_id", ctx.subjectId)
      .neq("kind", "page_hash")
      .order("detected_at", { ascending: false })
      .limit(50),
    sb.from("competitors").select("*").eq("subject_id", ctx.subjectId).order("created_at"),
  ]);

  return (
    <>
      <PageHeader
        title="競合・市場・トレンド監視"
        description="AIが日々、広報に関係する外部情報を監視します。重要な変化があった場合はLINEで通知し、必要に応じて広報企画を提案します。"
        agent="strategist"
        action={<AddCompetitor subjectId={ctx.subjectId} />}
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="検知した変化" subtitle="重要度の高いものはLINEへ通知されます。" />

            {!signals?.length ? (
              <EmptyState
                title="検知された変化はありません"
                body="競合を登録すると、サイトの更新・新サービス・季節イベントを監視します。"
              />
            ) : (
              <ul className="space-y-2.5 stagger">
                {signals.map((s) => (
                  <li
                    key={s.id}
                    className="p-3.5 rounded-xl border border-[var(--border)] flex items-start gap-3"
                  >
                    <span
                      className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                      style={{
                        background:
                          s.importance >= 4
                            ? "var(--color-bad)"
                            : s.importance >= 3
                              ? "var(--color-warn)"
                              : "var(--color-ink-400)",
                      }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge>{KIND_LABEL[s.kind] ?? s.kind}</Badge>
                        {s.notified && <Badge tone="info">通知済み</Badge>}
                        <span className="ml-auto muted text-[11px] tabular-nums">
                          {formatDateTime(s.detected_at)}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1.5 leading-snug">{s.title}</p>
                      {s.detail && (
                        <p className="muted text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                          {s.detail}
                        </p>
                      )}
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-brand-600 hover:underline mt-1 inline-block break-all"
                        >
                          {s.url}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="監視中の競合" />
            {!competitors?.length ? (
              <p className="muted text-xs">
                競合が未登録です。登録すると、サイト更新や新サービスを検知します。
              </p>
            ) : (
              <ul className="space-y-3">
                {competitors.map((c) => (
                  <li key={c.id} className="text-xs">
                    <p className="font-medium">{c.name}</p>
                    {c.positioning && <p className="muted mt-0.5 leading-relaxed">{c.positioning}</p>}
                    {c.website && (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline break-all"
                      >
                        {c.website}
                      </a>
                    )}
                    {(c.strengths ?? []).length > 0 && (
                      <p className="muted mt-1">強み: {(c.strengths ?? []).join("、")}</p>
                    )}
                    <p className="muted mt-1 tabular-nums">
                      最終確認: {c.last_checked_at ? formatDateTime(c.last_checked_at) : "未確認"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="監視の仕組み" />
            <ul className="space-y-2 text-xs">
              {[
                "競合サイト・監視URLの内容変化を検知",
                "季節・商習慣イベントの先回り通知",
                "月初の振り返り / 月末の計画リマインド",
                "重要度3以上は広報企画をAIが提案",
                "重要度4以上はLINEへ即時通知",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-brand-500 shrink-0" />
                  <span className="leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
            <p className="muted text-[11px] mt-3 leading-relaxed">
              監視は <code className="font-mono">/api/cron/monitor</code> の定期実行で動きます。
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
