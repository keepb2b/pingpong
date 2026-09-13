import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { PageHeader, AgentButton } from "@/components/dashboard/shared";
import { ScoreRing, ScoreBars, TrendChart } from "@/components/charts";
import { SCORE_DIMENSIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ScorePage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();
  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const { data: scores } = await sb
    .from("pr_scores")
    .select("*")
    .eq("subject_id", ctx.subjectId)
    .order("period", { ascending: false })
    .limit(12);

  const latest = scores?.[0];
  const rationale = (latest?.rationale ?? {}) as Record<string, string>;
  const improvements = (latest?.improvements ?? []) as Array<{
    dimension: string;
    action: string;
    expected: string;
    priority: number;
  }>;

  const history = (scores ?? [])
    .slice()
    .reverse()
    .map((s) => ({ x: s.period.slice(5), y: s.total }));

  return (
    <>
      <PageHeader
        title="AI広報スコア"
        description="毎月、広報活動を10の観点から評価します。総合点だけでなく、点数の根拠と改善方法を表示します。"
        agent="analyst"
        action={
          <AgentButton
            label={`${period}のスコアを算出`}
            body={{ action: "monthly_review", subjectId: ctx.subjectId, period }}
            successMessage="AIアナリストがスコアを算出しました"
          />
        }
      />

      {!latest ? (
        <Card>
          <EmptyState
            title="まだスコアが算出されていません"
            body="「今月のスコアを算出」を押すと、実際の活動データから10観点を評価します。"
          />
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader
                title="観点別スコア"
                subtitle="各項目は実データ(投稿数・検査結果・到達・成果など)から算出しています。カーソルを合わせると根拠が出ます。"
              />
              <ScoreBars
                items={SCORE_DIMENSIONS.map((d) => ({
                  label: d.label,
                  value: (latest[d.key] as number) ?? 0,
                  note: rationale[d.key],
                }))}
              />
            </Card>

            <Card>
              <CardHeader
                title="改善提案"
                subtitle="点数の低い項目から順に、具体的な行動と期待効果を示します。"
              />
              {!improvements.length ? (
                <p className="muted text-xs">改善提案はありません。</p>
              ) : (
                <ol className="space-y-3">
                  {improvements
                    .slice()
                    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9))
                    .map((im, i) => {
                      const dim = SCORE_DIMENSIONS.find((d) => d.key === im.dimension);
                      return (
                        <li key={i} className="p-4 rounded-xl border border-[var(--border)]">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="h-5 w-5 rounded-full bg-brand-600 text-white grid place-items-center text-[10px] font-bold shrink-0">
                              {im.priority ?? i + 1}
                            </span>
                            {dim && <Badge tone="brand">{dim.label}</Badge>}
                          </div>
                          <p className="text-sm font-medium leading-snug">{im.action}</p>
                          {im.expected && (
                            <p className="text-xs text-emerald-600 mt-1.5 leading-relaxed">
                              期待効果: {im.expected}
                            </p>
                          )}
                        </li>
                      );
                    })}
                </ol>
              )}
            </Card>

            {history.length > 1 && (
              <Card>
                <CardHeader title="スコアの推移" />
                <TrendChart series={[{ name: "総合スコア", points: history }]} unit="点" />
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader title="総合スコア" subtitle={`${latest.period} 時点`} />
              <div className="flex flex-col items-center">
                <ScoreRing value={latest.total} size={150} />
                <p className="muted text-xs mt-4 text-center leading-relaxed">
                  成果に近い指標(顧客導線・CV・売上)を重く評価しています。
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="10の評価観点" />
              <ul className="space-y-1.5">
                {SCORE_DIMENSIONS.map((d) => {
                  const v = (latest[d.key] as number) ?? 0;
                  return (
                    <li key={d.key} className="flex items-center justify-between gap-2 text-xs">
                      <span>{d.label}</span>
                      <span
                        className={`tabular-nums font-semibold ${
                          v < 40 ? "text-red-600" : v < 60 ? "text-amber-600" : "text-emerald-600"
                        }`}
                      >
                        {v}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {scores && scores.length > 1 && (
              <Card>
                <CardHeader title="過去のスコア" />
                <ul className="space-y-1.5">
                  {scores.slice(1).map((s) => (
                    <li key={s.period} className="flex items-center justify-between text-xs">
                      <span className="muted tabular-nums">{s.period}</span>
                      <span className="tabular-nums font-semibold">{s.total}点</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
