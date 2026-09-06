import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, StatTile } from "@/components/ui";
import { PageHeader, formatDate } from "@/components/dashboard/shared";
import { BillingActions } from "./Actions";
import { PRICING, SETUP_INCLUDES, yen } from "@/lib/constants";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  active: { label: "ご利用中", tone: "good" },
  trialing: { label: "トライアル中", tone: "good" },
  past_due: { label: "お支払い確認中", tone: "warn" },
  canceled: { label: "解約済み", tone: "neutral" },
  incomplete: { label: "手続き未完了", tone: "warn" },
  unpaid: { label: "未払い", tone: "bad" },
  none: { label: "未契約", tone: "neutral" },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const { status: checkoutStatus } = await searchParams;
  const sb = await supabaseServer();

  const [{ data: sub }, { count: subjectCount }, { data: events }] = await Promise.all([
    sb.from("subscriptions").select("*").eq("org_id", ctx.orgId).maybeSingle(),
    sb
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ctx.orgId)
      .eq("active", true),
    sb
      .from("billing_events")
      .select("type, created_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const status = sub?.status ?? "none";
  const meta = STATUS_META[status] ?? STATUS_META.none;
  const extra = Math.max(0, (subjectCount ?? 1) - 1);
  const monthly = PRICING.monthly + extra * PRICING.extraSubject;
  const canManage = ["owner", "admin"].includes(ctx.role);

  return (
    <>
      <PageHeader
        title="ご契約・料金"
        description="料金プランは一つだけです。対話頻度、投稿頻度、使用媒体は自由に設定できます。"
        action={<Badge tone={meta.tone}>{meta.label}</Badge>}
      />

      {checkoutStatus === "success" && (
        <Card className="mb-5 border-emerald-300">
          <p className="text-sm">
            お手続きありがとうございます。ご契約が完了しました。AI広報部の稼働を開始します。
          </p>
        </Card>
      )}
      {checkoutStatus === "cancelled" && (
        <Card className="mb-5 border-amber-300">
          <p className="text-sm">お手続きが中断されました。いつでも再開できます。</p>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile label="月額合計" value={yen(monthly)} accent="var(--color-brand-500)" />
        <StatTile label="広報対象" value={subjectCount ?? 0} unit="件" accent="var(--color-writer)" />
        <StatTile
          label="追加対象"
          value={extra}
          unit="件"
          hint={extra ? `${yen(extra * PRICING.extraSubject)}／月` : "追加なし"}
          accent="var(--color-marketer)"
        />
        <StatTile
          label="次回請求日"
          value={sub?.current_period_end ? formatDate(sub.current_period_end) : "—"}
          accent="var(--color-analyst)"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader
              title="料金内訳"
              subtitle={PRICING.taxNote}
            />
            <ul className="divide-y divide-[var(--border)]">
              <li className="py-3 flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">初期費用</p>
                  <p className="muted text-xs mt-0.5">
                    {sub?.setup_fee_paid ? "お支払い済み" : "初回のみ"}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {sub?.setup_fee_paid ? "—" : yen(PRICING.setup)}
                </span>
              </li>
              <li className="py-3 flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">月額料金</p>
                  <p className="muted text-xs mt-0.5">広報対象1件を含みます</p>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {yen(PRICING.monthly)}／月
                </span>
              </li>
              {extra > 0 && (
                <li className="py-3 flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">追加広報対象 × {extra}</p>
                    <p className="muted text-xs mt-0.5">
                      {yen(PRICING.extraSubject)}／月・1件
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">
                    {yen(extra * PRICING.extraSubject)}／月
                  </span>
                </li>
              )}
              <li className="py-3 flex items-baseline justify-between gap-4">
                <p className="text-sm font-bold">月額合計</p>
                <span className="text-lg font-bold tabular-nums shrink-0">{yen(monthly)}</span>
              </li>
            </ul>

            <div className="mt-5">
              <BillingActions
                status={status}
                canManage={canManage}
                extraSubjects={extra}
                hasCustomer={Boolean(sub?.stripe_customer_id)}
              />
              {!canManage && (
                <p className="muted text-[11px] mt-2">
                  ご契約の変更には管理者権限が必要です。
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="初期費用に含まれるもの" />
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {SETUP_INCLUDES.map((s) => (
                <li key={s} className="text-xs flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5 shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="m5 13 4 4 10-10"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="月額料金に含まれるもの" />
            <ul className="space-y-1.5">
              {[
                "6人の専門AIによる広報活動一式",
                "AI広報カルテ / 公式事実データベース",
                "承認フロー・権限設定",
                "媒体別のコンテンツ制作と配信",
                "ファクトチェックとリスク管理",
                "成果計測(売上まで)",
                "AI広報スコア",
                "月次AI広報会議",
                "競合・市場・トレンド監視",
                "コメント・口コミ管理",
                "危機広報モード",
                "メディアリレーション",
              ].map((s) => (
                <li key={s} className="text-xs flex items-start gap-2">
                  <span className="text-brand-600 mt-0.5 shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="m5 13 4 4 10-10"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </Card>

          {events && events.length > 0 && (
            <Card>
              <CardHeader title="請求の履歴" />
              <ul className="space-y-1.5">
                {events.map((e, i) => (
                  <li key={i} className="text-[11px] flex items-center gap-2">
                    <span className="muted tabular-nums">{formatDate(e.created_at)}</span>
                    <span className="truncate">{e.type}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
