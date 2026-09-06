"use client";

import { Button, callApi, toast } from "@/components/ui";

export function BillingActions({
  status,
  canManage,
  extraSubjects,
  hasCustomer,
}: {
  status: string;
  canManage: boolean;
  extraSubjects: number;
  hasCustomer: boolean;
}) {
  const isActive = ["active", "trialing", "past_due"].includes(status);

  if (isActive) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={!canManage || !hasCustomer}
          onClick={async () => {
            const res = await callApi<{ url: string }>("/api/stripe/portal", {});
            if (res?.url) window.location.href = res.url;
          }}
        >
          お支払い方法・請求書を管理
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="lg"
      disabled={!canManage}
      onClick={async () => {
        const res = await callApi<{ url: string }>("/api/stripe/checkout", { extraSubjects });
        if (res?.url) {
          window.location.href = res.url;
        } else {
          toast("お手続きを開始できませんでした", "err");
        }
      }}
    >
      ご契約手続きへ進む
    </Button>
  );
}
