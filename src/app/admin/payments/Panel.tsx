"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, Badge, Button, callApi, toast, type BadgeTone } from "@/components/ui";
import type { PaymentSummary } from "@/lib/admin";

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  succeeded: { label: "成功", tone: "good" },
  refunded: { label: "返金", tone: "warn" },
  pending: { label: "処理中", tone: "info" },
  failed: { label: "失敗", tone: "bad" },
};

function fmt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 決済履歴の一覧。
 * Stripe接続時は「最新を取得」で実データを取り込み、
 * 60秒ごとに自動で再取得して表示を最新に保つ。
 */
export function PaymentsPanel({
  initial,
  stripeReady,
}: {
  initial: PaymentSummary;
  stripeReady: boolean;
}) {
  const [summary, setSummary] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [auto, setAuto] = useState(stripeReady);

  async function refresh(fromStripe: boolean) {
    const res = await callApi<PaymentSummary & { sync?: { imported: number; note?: string } }>(
      "/api/admin",
      { action: fromStripe ? "refresh_payments" : "payments" },
    );
    if (!res) return;
    setSummary(res);
    setUpdatedAt(new Date());
    if (fromStripe && res.sync) {
      toast(
        res.sync.note ?? `Stripeから${res.sync.imported}件の決済を取り込みました`,
        res.sync.note ? "err" : "ok",
      );
    }
  }

  // 自動更新 (画面を開いている間、60秒ごと)
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => void refresh(true), 60_000);
    return () => clearInterval(id);
  }, [auto]);

  return (
    <Card>
      <CardHeader
        title="決済明細"
        subtitle={
          updatedAt
            ? `最終更新 ${updatedAt.toLocaleTimeString("ja-JP")}`
            : "Webhookで自動記録され、下のボタンでStripeから再取得できます。"
        }
        action={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={auto}
                disabled={!stripeReady}
                onChange={(e) => setAuto(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--color-brand-600)]"
              />
              自動更新
            </label>
            <Button size="sm" variant="secondary" onClick={() => refresh(stripeReady)}>
              最新を取得
            </Button>
          </div>
        }
      />

      <div className="overflow-x-auto scroll-thin">
        <table className="data-table">
          <thead>
            <tr>
              <th>日時</th>
              <th>組織</th>
              <th>内容</th>
              <th className="text-right">金額</th>
              <th>状態</th>
              <th>領収書</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((p) => {
              const meta = STATUS_META[p.status] ?? { label: p.status, tone: "neutral" as BadgeTone };
              return (
                <tr key={p.id}>
                  <td className="tabular-nums whitespace-nowrap">{fmt(p.paid_at)}</td>
                  <td className="max-w-[14rem] truncate">{p.org_name ?? "(未紐づけ)"}</td>
                  <td className="max-w-[18rem] truncate">{p.description ?? "—"}</td>
                  <td className="text-right tabular-nums font-semibold whitespace-nowrap">
                    ¥{p.amount.toLocaleString("ja-JP")}
                  </td>
                  <td>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </td>
                  <td>
                    {p.receipt_url ? (
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--link)] hover:underline text-[12px] whitespace-nowrap"
                      >
                        表示
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!summary.rows.length && (
              <tr>
                <td colSpan={6} className="text-center muted py-8">
                  決済履歴がまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
