import { getPaymentSummary } from "@/lib/admin";
import { isStripeConfigured } from "@/lib/stripe";
import { Card, CardHeader, StatTile } from "@/components/ui";
import { TrendChart, ChannelBars } from "@/components/charts";
import { PaymentsPanel } from "./Panel";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const summary = await getPaymentSummary(200);
  const stripeReady = isStripeConfigured();

  const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
  const thisMonth = summary.byMonth.at(-1)?.y ?? 0;
  const lastMonth = summary.byMonth.at(-2)?.y ?? 0;
  const delta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : undefined;

  return (
    <>
      <h1 className="section-title text-[18px]">決済履歴</h1>

      {!stripeReady && (
        <div className="card p-4 mb-5 border-l-[3px] border-l-[var(--color-accent-500)]">
          <p className="text-[13px] font-semibold">Stripeが未接続です</p>
          <p className="muted text-[12px] mt-1 leading-relaxed">
            <code className="font-mono">STRIPE_SECRET_KEY</code> を設定すると、Stripeから実際の決済を
            取り込めます。現在は Webhook 経由で保存済みの履歴のみ表示しています。
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="今月の売上"
          value={yen(thisMonth)}
          delta={delta}
          accent="var(--color-brand-600)"
          hint={`前月 ${yen(lastMonth)}`}
        />
        <StatTile label="累計 (成功分)" value={yen(summary.succeededTotal)} accent="#1d6f4a" />
        <StatTile
          label="返金"
          value={yen(summary.refundedTotal)}
          accent={summary.refundedTotal ? "#c8102e" : "#97a2ae"}
        />
        <StatTile label="決済件数" value={summary.count} unit="件" accent="#0f6e8c" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <Card className="lg:col-span-2">
          <CardHeader title="月次売上の推移" subtitle="直近12か月。成功した決済のみを集計しています。" />
          <TrendChart series={[{ name: "売上", points: summary.byMonth }]} unit="円" />
        </Card>

        <Card>
          <CardHeader title="決済の状態" />
          <ChannelBars items={summary.byStatus} unit="件" />
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader title="組織別の売上" subtitle="上位6組織。" />
        <ChannelBars items={summary.topOrgs} unit="円" />
      </Card>

      <PaymentsPanel initial={summary} stripeReady={stripeReady} />
    </>
  );
}
