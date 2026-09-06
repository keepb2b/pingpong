import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, StatTile, Badge, EmptyState } from "@/components/ui";
import { PageHeader, AgentButton } from "@/components/dashboard/shared";
import { FunnelChart, ChannelBars, TrendChart } from "@/components/charts";
import { CHANNEL_LABEL, CONVERSION_LABEL, OUTCOME_CONVERSIONS, type ChannelKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();
  const since = new Date(Date.now() - 30 * 864e5);
  const sinceIso = since.toISOString();

  const [{ data: metrics }, { data: conversions }, { data: links }, { data: attribution }] =
    await Promise.all([
      sb
        .from("metrics_daily")
        .select("day, channel, impressions, reach, engagements, clicks, pageviews, search_clicks")
        .eq("subject_id", ctx.subjectId)
        .gte("day", sinceIso.slice(0, 10))
        .order("day"),
      sb
        .from("conversions")
        .select("type, amount, channel, occurred_at, content_id")
        .eq("subject_id", ctx.subjectId)
        .gte("occurred_at", sinceIso),
      sb
        .from("tracking_links")
        .select("code, clicks, channel, content_id, target_url")
        .eq("subject_id", ctx.subjectId)
        .order("clicks", { ascending: false })
        .limit(10),
      sb.rpc("attribution_summary", {
        p_subject: ctx.subjectId,
        p_from: sinceIso,
        p_to: new Date().toISOString(),
      }),
    ]);

  const m = metrics ?? [];
  const convs = conversions ?? [];

  const totals = {
    impressions: sum(m, "impressions"),
    engagements: sum(m, "engagements"),
    clicks: sum(m, "clicks") + (links ?? []).reduce((a, l) => a + (l.clicks ?? 0), 0),
    pageviews: sum(m, "pageviews"),
    searchClicks: sum(m, "search_clicks"),
  };

  const byType: Record<string, number> = {};
  for (const c of convs) byType[c.type] = (byType[c.type] ?? 0) + 1;

  const outcomes = convs.filter((c) => OUTCOME_CONVERSIONS.includes(c.type));
  const revenue = convs.reduce((a, c) => a + Number(c.amount ?? 0), 0);

  // 顧客導線: 表示 → 閲覧 → CTAクリック → 問い合わせ・予約 → 成約
  const funnel = [
    { label: "投稿を見る (表示)", value: totals.impressions, hint: "SNS・検索での表示回数" },
    { label: "記事を読む (PV)", value: totals.pageviews, hint: "記事・LPの閲覧数" },
    { label: "CTAをクリックする", value: byType.cta_click ?? totals.clicks, hint: "専用リンク経由の遷移" },
    {
      label: "問い合わせ・予約をする",
      value:
        (byType.inquiry ?? 0) + (byType.booking ?? 0) + (byType.doc_request ?? 0) + (byType.call ?? 0),
      hint: "問い合わせ・予約・資料請求・電話",
    },
    {
      label: "購入・成約する",
      value: (byType.purchase ?? 0) + (byType.contract ?? 0),
      hint: "購入・成約",
    },
  ];

  // 媒体別のリーチ
  const byChannel: Record<string, number> = {};
  for (const row of m) {
    if (!row.channel) continue;
    byChannel[row.channel] = (byChannel[row.channel] ?? 0) + (row.impressions ?? 0);
  }

  // 日次の成果推移
  const dayMap: Record<string, number> = {};
  for (const c of outcomes) {
    const d = new Date(c.occurred_at).toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
      timeZone: "Asia/Tokyo",
    });
    dayMap[d] = (dayMap[d] ?? 0) + 1;
  }
  const trendPoints = Object.entries(dayMap).map(([x, y]) => ({ x, y }));

  const attributionRows = (attribution ?? []) as Array<{
    content_id: string;
    title: string;
    first_touch: number;
    mid_touch: number;
    last_touch: number;
    conversions: number;
    revenue: number;
  }>;

  return (
    <>
      <PageHeader
        title="成果分析"
        description="投稿数や「いいね」の数ではなく、問い合わせ・予約・購入・成約までを追跡します。直近30日間の実績です。"
        agent="analyst"
        action={
          <AgentButton
            label="顧客導線を診断する"
            body={{ action: "design_funnel", subjectId: ctx.subjectId, goal: "inquiry" }}
            variant="secondary"
            successMessage="AIマーケターが導線を診断しました"
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5 stagger">
        <StatTile label="表示" value={totals.impressions} accent="var(--color-strategist)" />
        <StatTile label="エンゲージメント" value={totals.engagements} accent="var(--color-marketer)" />
        <StatTile label="CTAクリック" value={totals.clicks} accent="var(--color-writer)" />
        <StatTile label="成果 (問い合わせ等)" value={outcomes.length} accent="var(--color-analyst)" />
        <StatTile
          label="成約金額"
          value={`¥${revenue.toLocaleString("ja-JP")}`}
          accent="var(--color-creator)"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader
              title="顧客導線"
              subtitle="どの段階で離脱しているかを見ます。残存率が低い段階が改善対象です。"
            />
            <FunnelChart stages={funnel} />
          </Card>

          <Card>
            <CardHeader
              title="成果につながったコンテンツ"
              subtitle="最初に接触した投稿、途中で読んだ記事、最後に行動を起こした媒体を分けて評価します。"
            />
            {!attributionRows.length ? (
              <EmptyState
                title="まだ紐づく成果がありません"
                body="専用リンク経由の接触と成果が記録されると、貢献度が表示されます。"
              />
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] muted">
                      <th className="text-left py-2 pr-3 font-medium">コンテンツ</th>
                      <th className="text-right py-2 px-2 font-medium">初回接触</th>
                      <th className="text-right py-2 px-2 font-medium">中間</th>
                      <th className="text-right py-2 px-2 font-medium">最終接触</th>
                      <th className="text-right py-2 px-2 font-medium">成果</th>
                      <th className="text-right py-2 pl-2 font-medium">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attributionRows.map((r) => (
                      <tr key={r.content_id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2 pr-3 max-w-[16rem] truncate">{r.title}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{r.first_touch}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{r.mid_touch}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{r.last_touch}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold">
                          {r.conversions}
                        </td>
                        <td className="py-2 pl-2 text-right tabular-nums">
                          ¥{Number(r.revenue ?? 0).toLocaleString("ja-JP")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {trendPoints.length > 1 && (
            <Card>
              <CardHeader title="成果の推移" subtitle="問い合わせ・予約・購入・成約などの発生件数" />
              <TrendChart series={[{ name: "成果", points: trendPoints }]} unit="件" />
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="媒体別の表示" />
            <ChannelBars
              items={Object.entries(byChannel)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => ({
                  label: CHANNEL_LABEL[k as ChannelKey] ?? k,
                  value: v,
                }))}
            />
          </Card>

          <Card>
            <CardHeader title="成果の内訳" />
            {!Object.keys(byType).length ? (
              <p className="muted text-xs">まだ成果が記録されていません。</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between gap-2 text-xs">
                      <span>{CONVERSION_LABEL[k] ?? k}</span>
                      <span className="tabular-nums font-semibold">{v}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="専用リンク" subtitle="クリック数の多い順" />
            {!links?.length ? (
              <p className="muted text-xs">計測リンクがありません。</p>
            ) : (
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l.code} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono truncate">/t/{l.code}</span>
                      <span className="tabular-nums font-semibold shrink-0">{l.clicks}</span>
                    </div>
                    {l.channel && (
                      <Badge tone="info" className="mt-1">
                        {CHANNEL_LABEL[l.channel as ChannelKey] ?? l.channel}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="成果の計測方法"
              subtitle="自社サイトのフォーム送信時に、この計測エンドポイントを呼び出してください。"
            />
            <pre className="text-[10px] leading-relaxed p-3 rounded-[3px] bg-[var(--surface-3)] overflow-x-auto scroll-thin">
              {`fetch("/api/track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    subject_id: "${ctx.subjectId}",
    type: "inquiry",
    amount: 0
  })
})`}
            </pre>
            <p className="muted text-[11px] mt-2 leading-relaxed">
              専用リンク経由で訪れた訪問者は自動的に識別され、どの投稿が成果につながったかが紐づきます。
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function sum(rows: Array<Record<string, unknown>>, key: string): number {
  return rows.reduce((a, r) => a + Number(r[key] ?? 0), 0);
}
